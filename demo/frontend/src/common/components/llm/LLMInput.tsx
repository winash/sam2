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
import {Spinner} from '@/common/components/loading/Spinner';
import {
  activeTrackletObjectIdAtom,
  frameIndexAtom,
  sessionAtom,
} from '@/demo/atoms';
import {ProcessTextPromptMutation} from '@/graphql/mutations/ProcessTextPromptMutation';
import {color, font, spacing} from '@/theme/tokens.stylex';
import {PaperAirplaneIcon} from '@heroicons/react/24/solid';
import stylex from '@stylexjs/stylex';
import {useAtomValue, useSetAtom} from 'jotai';
import {FormEvent, useState} from 'react';
import {useMutation} from 'react-relay';

const styles = stylex.create({
  container: {
    width: '100%',
    position: 'relative',
    marginTop: spacing[4],
    marginBottom: spacing[4],
  },
  inputContainer: {
    position: 'relative',
    display: 'flex',
    marginBottom: spacing[2],
  },
  formInput: {
    backgroundColor: color['gray-100'],
    border: `1px solid ${color['gray-300']}`,
    borderRadius: '0.375rem',
    padding: spacing[2],
    paddingRight: spacing[10],
    width: '100%',
    fontFamily: font['sans-serif'],
    fontSize: font['text-sm'],
    '::placeholder': {
      color: color['gray-500'],
    },
  },
  submitButton: {
    position: 'absolute',
    right: 0,
    top: 0,
    height: '100%',
    padding: spacing[2],
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderTopRightRadius: '0.375rem',
    borderBottomRightRadius: '0.375rem',
    ':hover': {
      backgroundColor: color['gray-200'],
    },
  },
  submitIcon: {
    width: spacing[5],
    height: spacing[5],
    color: color['blue-500'],
  },
  loadingContainer: {
    position: 'absolute',
    right: spacing[2],
    top: '50%',
    transform: 'translateY(-50%)',
  },
  resultContainer: {
    marginTop: spacing[2],
    padding: spacing[2],
    backgroundColor: color['gray-100'],
    borderRadius: '0.375rem',
    fontSize: font['text-sm'],
  },
  successMessage: {
    color: color['green-700'],
  },
  errorMessage: {
    color: color['red-700'],
  },
  smallText: {
    fontSize: font['text-xs'],
    color: color['gray-600'],
    marginTop: spacing[1],
  },
  examplesContainer: {
    marginTop: spacing[2],
  },
  exampleItem: {
    cursor: 'pointer',
    padding: spacing[1],
    marginBottom: spacing[1],
    borderRadius: '0.25rem',
    color: color['blue-600'],
    ':hover': {
      backgroundColor: color['gray-200'],
    },
  },
});

const EXAMPLES = [
  'Find the person in the video',
  'Replace the red cup with a watermelon',
  'Replace the person\'s face with a smiley face',
  'Find and track the dog in this video',
];

export function LLMInput() {
  const [prompt, setPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const session = useAtomValue(sessionAtom);
  const frameIndex = useAtomValue(frameIndexAtom);
  const setActiveTrackletObjectId = useSetAtom(activeTrackletObjectIdAtom);

  const [commit] = useMutation(ProcessTextPromptMutation);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    
    if (!prompt || !session?.id) return;
    
    setIsProcessing(true);
    setResult(null);
    
    commit({
      variables: {
        input: {
          sessionId: session.id,
          frameIndex,
          textPrompt: prompt,
        },
      },
      onCompleted: data => {
        setIsProcessing(false);
        
        const response = data.processTextPrompt;
        setResult({
          success: response.success,
          message: response.message,
        });
        
        // If successful and we have an object ID, set it as the active tracklet
        if (response.success && response.objectId != null) {
          setActiveTrackletObjectId(response.objectId);
        }
      },
      onError: error => {
        setIsProcessing(false);
        setResult({
          success: false,
          message: error.message,
        });
      },
    });
  };

  const handleExampleClick = (example: string) => {
    setPrompt(example);
  };

  return (
    <div {...stylex.props(styles.container)}>
      <form onSubmit={handleSubmit}>
        <div {...stylex.props(styles.inputContainer)}>
          <input
            type="text"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            placeholder="Describe what to find or replace in the video..."
            {...stylex.props(styles.formInput)}
            disabled={isProcessing || !session?.id}
          />
          
          {isProcessing ? (
            <div {...stylex.props(styles.loadingContainer)}>
              <Spinner size="sm" />
            </div>
          ) : (
            <button
              type="submit"
              {...stylex.props(styles.submitButton)}
              disabled={!prompt || !session?.id}>
              <PaperAirplaneIcon {...stylex.props(styles.submitIcon)} />
            </button>
          )}
        </div>
      </form>
      
      {result && (
        <div {...stylex.props(styles.resultContainer)}>
          <div
            {...stylex.props(
              result.success ? styles.successMessage : styles.errorMessage,
            )}>
            {result.message}
          </div>
        </div>
      )}
      
      <div {...stylex.props(styles.smallText)}>
        Describe what to find or replace in natural language. The AI will try to
        identify and segment the object.
      </div>
      
      <div {...stylex.props(styles.examplesContainer)}>
        <div {...stylex.props(styles.smallText)}>Examples:</div>
        {EXAMPLES.map((example, index) => (
          <div
            key={index}
            {...stylex.props(styles.exampleItem)}
            onClick={() => handleExampleClick(example)}>
            {example}
          </div>
        ))}
      </div>
    </div>
  );
}