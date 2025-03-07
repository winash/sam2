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
import {GetReplacementImagesQuery} from '@/graphql/queries/GetReplacementImagesQuery';
import {color, font, spacing} from '@/theme/tokens.stylex';
import {PlusIcon} from '@heroicons/react/24/outline';
import stylex from '@stylexjs/stylex';
import {useState} from 'react';
import {graphql, useLazyLoadQuery} from 'react-relay';
import {ReplacementImageUploader} from './ReplacementImageUploader';

const styles = stylex.create({
  container: {
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[4],
    width: '100%',
  },
  heading: {
    fontSize: font['text-lg'],
    fontWeight: '600',
    color: color['gray-900'],
    marginBottom: spacing[2],
  },
  imagesGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))',
    gap: spacing[2],
    marginBottom: spacing[4],
  },
  imageCard: {
    border: `1px solid ${color['gray-300']}`,
    borderRadius: spacing[1],
    overflow: 'hidden',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    ':hover': {
      transform: 'scale(1.05)',
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    },
  },
  imageCardSelected: {
    border: `2px solid ${color['blue-500']}`,
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
  },
  image: {
    width: '100%',
    height: '100px',
    objectFit: 'cover',
  },
  addNewCard: {
    border: `1px dashed ${color['gray-300']}`,
    borderRadius: spacing[1],
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100px',
    cursor: 'pointer',
    backgroundColor: color['gray-100'],
    transition: 'all 0.2s ease',
    ':hover': {
      borderColor: color['blue-400'],
      backgroundColor: color['blue-50'],
    },
  },
  addIcon: {
    width: spacing[6],
    height: spacing[6],
    color: color['gray-500'],
  },
  modal: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 50,
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: spacing[2],
    padding: spacing[4],
    width: '90%',
    maxWidth: '500px',
    maxHeight: '90vh',
    overflow: 'auto',
  },
  modalHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing[4],
  },
  modalTitle: {
    fontSize: font['text-lg'],
    fontWeight: '600',
    color: color['gray-900'],
  },
  closeButton: {
    backgroundColor: 'transparent',
    border: 'none',
    cursor: 'pointer',
    fontSize: font['text-xl'],
    color: color['gray-500'],
    ':hover': {
      color: color['gray-800'],
    },
  },
  emptyState: {
    textAlign: 'center',
    padding: spacing[4],
    color: color['gray-500'],
    backgroundColor: color['gray-100'],
    borderRadius: spacing[2],
    fontSize: font['text-sm'],
  },
});

interface ReplacementImage {
  id: string;
  path: string;
  url: string;
  width: number;
  height: number;
}

interface Props {
  onSelectImage?: (image: ReplacementImage) => void;
  selectedImageId?: string;
}

export function ReplacementImageGallery({
  onSelectImage,
  selectedImageId,
}: Props) {
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const data = useLazyLoadQuery(
    GetReplacementImagesQuery,
    {},
    {fetchPolicy: 'network-only', fetchKey: refreshKey},
  );

  const images = data.replacementImages.images;

  const handleSelectImage = (image: ReplacementImage) => {
    if (onSelectImage) {
      onSelectImage(image);
    }
  };

  const handleUploadComplete = () => {
    // Close modal and refresh the image list
    setShowUploadModal(false);
    setRefreshKey(prev => prev + 1);
  };

  return (
    <div {...stylex.props(styles.container)}>
      <div {...stylex.props(styles.heading)}>Replacement Images</div>

      {images.length === 0 ? (
        <div {...stylex.props(styles.emptyState)}>
          No replacement images yet. Click the button below to upload your first
          image.
        </div>
      ) : (
        <div {...stylex.props(styles.imagesGrid)}>
          {images.map(image => (
            <div
              key={image.id}
              {...stylex.props(
                styles.imageCard,
                selectedImageId === image.id && styles.imageCardSelected,
              )}
              onClick={() => handleSelectImage(image)}>
              <img
                src={image.url}
                alt="Replacement"
                {...stylex.props(styles.image)}
              />
            </div>
          ))}
          <div
            {...stylex.props(styles.addNewCard)}
            onClick={() => setShowUploadModal(true)}>
            <PlusIcon {...stylex.props(styles.addIcon)} />
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {showUploadModal && (
        <div {...stylex.props(styles.modal)}>
          <div {...stylex.props(styles.modalContent)}>
            <div {...stylex.props(styles.modalHeader)}>
              <div {...stylex.props(styles.modalTitle)}>Upload New Image</div>
              <button
                {...stylex.props(styles.closeButton)}
                onClick={() => setShowUploadModal(false)}>
                ×
              </button>
            </div>
            <ReplacementImageUploader onUploadComplete={handleUploadComplete} />
          </div>
        </div>
      )}
    </div>
  );
}