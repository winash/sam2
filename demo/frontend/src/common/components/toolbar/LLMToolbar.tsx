/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
import {LLMInput} from '@/common/components/llm/LLMInput';
import {ReplacementImageGallery} from '@/common/components/images/ReplacementImageGallery';
import {
  activeTrackletObjectIdAtom,
  sessionAtom,
} from '@/demo/atoms';
import ToolbarBottomActionsWrapper from '@/common/components/toolbar/ToolbarBottomActionsWrapper';
import PrimaryCTAButton from '@/common/components/button/PrimaryCTAButton';
import RestartSessionButton from '@/common/components/session/RestartSessionButton';
import {
  MORE_OPTIONS_TOOLBAR_INDEX,
  OBJECT_TOOLBAR_INDEX,
} from '@/common/components/toolbar/ToolbarConfig';
import {ChevronRight} from '@carbon/icons-react';
import {SetReplacementImageMutation} from '@/graphql/mutations/SetReplacementImageMutation';
import {color, spacing} from '@/theme/tokens.stylex';
import stylex from '@stylexjs/stylex';
import {useAtomValue} from 'jotai';
import {useState} from 'react';
import {useMutation} from 'react-relay';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[4],
    width: '100%',
    padding: spacing[4],
  },
  section: {
    marginBottom: spacing[4],
  },
  divider: {
    height: '1px',
    width: '100%',
    backgroundColor: color['gray-300'],
    margin: `${spacing[4]} 0`,
  },
  header: {
    fontSize: '1.1rem',
    fontWeight: '600',
    color: color['gray-900'],
    marginBottom: spacing[2],
  },
  description: {
    fontSize: '0.9rem',
    color: color['gray-600'],
    marginBottom: spacing[4],
  },
  sectionTitle: {
    fontSize: '1rem',
    fontWeight: '600',
    color: color['gray-900'],
    marginBottom: spacing[2],
  },
  successMessage: {
    color: color['green-600'],
    fontSize: '0.9rem',
    marginTop: spacing[2],
  },
  errorMessage: {
    color: color['red-600'],
    fontSize: '0.9rem',
    marginTop: spacing[2],
  },
});

interface Props {
  onTabChange?: (newIndex: number) => void;
}

export function LLMToolbar({onTabChange}: Props = {}) {
  const session = useAtomValue(sessionAtom);
  const activeTrackletObjectId = useAtomValue(activeTrackletObjectIdAtom);
  const [selectedImageId, setSelectedImageId] = useState<string | null>(null);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const [commit] = useMutation(SetReplacementImageMutation);

  const handleSelectImage = (image: {id: string}) => {
    setSelectedImageId(image.id);
    
    if (!session?.id || activeTrackletObjectId === null) {
      setMessage({
        type: 'error',
        text: 'Please select an object first by adding points to it',
      });
      return;
    }
    
    // Set the replacement image for the currently selected object
    commit({
      variables: {
        input: {
          sessionId: session.id,
          objectId: activeTrackletObjectId,
          imageId: image.id,
        },
      },
      onCompleted: data => {
        if (data.setReplacementImage.success) {
          setMessage({
            type: 'success',
            text: 'Replacement image set successfully!',
          });
        } else {
          setMessage({
            type: 'error',
            text: data.setReplacementImage.message || 'Failed to set replacement image',
          });
        }
      },
      onError: error => {
        setMessage({
          type: 'error',
          text: error.message,
        });
      },
    });
  };

  return (
    <div {...stylex.props(styles.container)}>
      <div {...stylex.props(styles.section)}>
        <div {...stylex.props(styles.header)}>AI-Powered Editing</div>
        <div {...stylex.props(styles.description)}>
          Use natural language to identify and segment objects in your video,
          then replace them with custom images.
        </div>
      </div>

      <div {...stylex.props(styles.section)}>
        <div {...stylex.props(styles.sectionTitle)}>1. Describe what to find or replace</div>
        <LLMInput />
      </div>

      <div {...stylex.props(styles.divider)} />

      <div {...stylex.props(styles.section)}>
        <div {...stylex.props(styles.sectionTitle)}>
          2. Select a replacement image
          {activeTrackletObjectId !== null && (
            <span> for object #{activeTrackletObjectId}</span>
          )}
        </div>
        <ReplacementImageGallery
          onSelectImage={handleSelectImage}
          selectedImageId={selectedImageId || undefined}
        />
        
        {message && (
          <div
            {...stylex.props(
              message.type === 'success'
                ? styles.successMessage
                : styles.errorMessage,
            )}>
            {message.text}
          </div>
        )}
      </div>
      
      {onTabChange && (
        <ToolbarBottomActionsWrapper>
          <RestartSessionButton
            onRestartSession={() => onTabChange(OBJECT_TOOLBAR_INDEX)}
          />
          <PrimaryCTAButton
            onClick={() => onTabChange(MORE_OPTIONS_TOOLBAR_INDEX)}
            endIcon={<ChevronRight />}>
            Next
          </PrimaryCTAButton>
        </ToolbarBottomActionsWrapper>
      )}
    </div>
  );
}