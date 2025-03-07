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
import {useDropzone} from 'react-dropzone';
import {PhotoIcon, ArrowUpTrayIcon} from '@heroicons/react/24/outline';
import {color, font, spacing} from '@/theme/tokens.stylex';
import stylex from '@stylexjs/stylex';
import {useMutation} from 'react-relay';
import {UploadReplacementImageMutation} from '@/graphql/mutations/UploadReplacementImageMutation';
import {useState} from 'react';

const styles = stylex.create({
  container: {
    width: '100%',
    display: 'flex',
    flexDirection: 'column',
    gap: spacing[4],
  },
  dropzoneContainer: {
    border: `2px dashed ${color['gray-300']}`,
    borderRadius: spacing[2],
    padding: spacing[4],
    textAlign: 'center',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    backgroundColor: color['gray-100'],
    ':hover': {
      borderColor: color['blue-400'],
      backgroundColor: color['blue-50'],
    },
  },
  dropzoneActive: {
    borderColor: color['blue-500'],
    backgroundColor: color['blue-50'],
  },
  dropzoneIcon: {
    width: spacing[10],
    height: spacing[10],
    margin: '0 auto',
    marginBottom: spacing[2],
    color: color['gray-400'],
  },
  dropzoneText: {
    fontSize: font['text-sm'],
    color: color['gray-600'],
    marginBottom: spacing[2],
  },
  dropzoneHint: {
    fontSize: font['text-xs'],
    color: color['gray-500'],
  },
  imagePreviewContainer: {
    marginTop: spacing[4],
    width: '100%',
  },
  imagePreview: {
    width: '100%',
    maxHeight: '200px',
    objectFit: 'contain',
    borderRadius: spacing[2],
    border: `1px solid ${color['gray-300']}`,
  },
  uploadButtonContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginTop: spacing[2],
  },
  uploadButton: {
    display: 'flex',
    alignItems: 'center',
    gap: spacing[2],
    padding: `${spacing[2]} ${spacing[4]}`,
    backgroundColor: color['blue-500'],
    color: 'white',
    borderRadius: spacing[1],
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
    fontSize: font['text-sm'],
    fontWeight: '500',
    ':hover': {
      backgroundColor: color['blue-600'],
    },
    ':disabled': {
      backgroundColor: color['gray-400'],
      cursor: 'not-allowed',
    },
  },
  uploadIcon: {
    width: spacing[4],
    height: spacing[4],
  },
  successMessage: {
    color: color['green-600'],
    fontSize: font['text-sm'],
    textAlign: 'center',
    margin: `${spacing[2]} 0`,
  },
  errorMessage: {
    color: color['red-600'],
    fontSize: font['text-sm'],
    textAlign: 'center',
    margin: `${spacing[2]} 0`,
  },
});

interface UploadResult {
  success: boolean;
  message: string;
  imageId?: string;
  path?: string;
}

interface Props {
  onUploadComplete?: (result: UploadResult) => void;
}

export function ReplacementImageUploader({onUploadComplete}: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<UploadResult | null>(null);
  
  const [commit] = useMutation(UploadReplacementImageMutation);
  
  const onDrop = (acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setFile(file);
      
      // Create preview URL
      const url = URL.createObjectURL(file);
      setPreviewUrl(url);
      
      // Reset any previous results
      setUploadResult(null);
    }
  };
  
  const {getRootProps, getInputProps, isDragActive} = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg', '.gif'],
    },
    maxFiles: 1,
    maxSize: 5 * 1024 * 1024, // 5MB max
  });
  
  const handleUpload = () => {
    if (!file) return;
    
    setIsUploading(true);
    setUploadResult(null);
    
    commit({
      variables: {
        file,
        name: file.name,
      },
      uploadables: {
        file,
      },
      onCompleted: data => {
        setIsUploading(false);
        
        const result = {
          success: data.uploadReplacementImage.success,
          message: data.uploadReplacementImage.message,
          imageId: data.uploadReplacementImage.imageId,
          path: data.uploadReplacementImage.path,
        };
        
        setUploadResult(result);
        
        if (onUploadComplete) {
          onUploadComplete(result);
        }
        
        // Reset file selection if successful
        if (result.success) {
          setFile(null);
          if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            setPreviewUrl(null);
          }
        }
      },
      onError: error => {
        setIsUploading(false);
        const result = {
          success: false,
          message: error.message,
        };
        setUploadResult(result);
        
        if (onUploadComplete) {
          onUploadComplete(result);
        }
      },
    });
  };
  
  return (
    <div {...stylex.props(styles.container)}>
      <div
        {...getRootProps()}
        {...stylex.props(
          styles.dropzoneContainer,
          isDragActive && styles.dropzoneActive,
        )}>
        <input {...getInputProps()} />
        {!previewUrl ? (
          <>
            <PhotoIcon {...stylex.props(styles.dropzoneIcon)} />
            <div {...stylex.props(styles.dropzoneText)}>
              Drag & drop an image here, or click to select
            </div>
            <div {...stylex.props(styles.dropzoneHint)}>
              Supported formats: JPG, PNG, GIF (Max 5MB)
            </div>
          </>
        ) : (
          <img
            src={previewUrl}
            alt="Preview"
            {...stylex.props(styles.imagePreview)}
          />
        )}
      </div>
      
      {previewUrl && (
        <div {...stylex.props(styles.uploadButtonContainer)}>
          <button
            {...stylex.props(styles.uploadButton)}
            onClick={handleUpload}
            disabled={isUploading || !file}>
            {isUploading ? (
              <>
                <Spinner size="sm" /> Uploading...
              </>
            ) : (
              <>
                <ArrowUpTrayIcon {...stylex.props(styles.uploadIcon)} />
                Upload Image
              </>
            )}
          </button>
        </div>
      )}
      
      {uploadResult && (
        <div
          {...stylex.props(
            uploadResult.success ? styles.successMessage : styles.errorMessage,
          )}>
          {uploadResult.message}
        </div>
      )}
    </div>
  );
}