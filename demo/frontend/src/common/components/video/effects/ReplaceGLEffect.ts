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
import angeryIcon from '@/assets/icons/angery.png';
import heartIcon from '@/assets/icons/heart.png';
import whistleIcon from '@/assets/icons/whistle.png';
import BaseGLEffect from '@/common/components/video/effects/BaseGLEffect';
import {
  EffectFrameContext,
  EffectInit,
} from '@/common/components/video/effects/Effect';
import vertexShaderSource from '@/common/components/video/effects/shaders/DefaultVert.vert?raw';
import fragmentShaderSource from '@/common/components/video/effects/shaders/Replace.frag?raw';
import {Tracklet} from '@/common/tracker/Tracker';
import {normalizeBounds, preAllocateTextures} from '@/common/utils/ShaderUtils';
import {RLEObject, decode} from '@/jscocotools/mask';
import invariant from 'invariant';
import {CanvasForm} from 'pts';

export default class ReplaceGLEffect extends BaseGLEffect {
  private _numMasks: number = 0;
  private _numMasksUniformLocation: WebGLUniformLocation | null = null;
  private _bitmap: ImageBitmap[] = [];
  private _customImage: ImageBitmap | null = null;
  private _extraTextureUnit: number = 1;
  private _extraTexture: WebGLTexture | null = null;
  private _fillBg: number = 0;
  private _fillBgLocation: WebGLUniformLocation | null = null;
  private _masksTextureUnitStart: number = 2;
  private _maskTextures: WebGLTexture[] = [];
  private _useCustomImage: boolean = false;
  private _useCustomImageLocation: WebGLUniformLocation | null = null;

  constructor() {
    super(6);
    this.vertexShaderSource = vertexShaderSource;
    this.fragmentShaderSource = fragmentShaderSource;
  }

  /**
   * Set a custom image to use for replacement
   */
  public async setCustomImage(imageUrl: string): Promise<void> {
    try {
      // Load the image
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      this._customImage = await createImageBitmap(blob);
      this._useCustomImage = true;
      
      // If we have a GL context, update the texture
      if (this._gl && this._extraTexture) {
        this._gl.activeTexture(this._gl.TEXTURE0 + this._extraTextureUnit);
        this._gl.bindTexture(this._gl.TEXTURE_2D, this._extraTexture);
        
        this._gl.texImage2D(
          this._gl.TEXTURE_2D,
          0,
          this._gl.RGBA,
          this._customImage.width,
          this._customImage.height,
          0,
          this._gl.RGBA,
          this._gl.UNSIGNED_BYTE,
          this._customImage,
        );
        
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MIN_FILTER, this._gl.LINEAR);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_MAG_FILTER, this._gl.LINEAR);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_S, this._gl.CLAMP_TO_EDGE);
        this._gl.texParameteri(this._gl.TEXTURE_2D, this._gl.TEXTURE_WRAP_T, this._gl.CLAMP_TO_EDGE);
        
        // Update uniform if it exists
        if (this._useCustomImageLocation) {
          this._gl.uniform1i(this._useCustomImageLocation, 1);
        }
      }
    } catch (error) {
      console.error('Error loading custom replacement image:', error);
      this._useCustomImage = false;
    }
  }

  /**
   * Reset to use default icons instead of custom image
   */
  public resetToDefaultImages(): void {
    this._useCustomImage = false;
    this._customImage = null;
    
    // Update uniform if it exists
    if (this._gl && this._useCustomImageLocation) {
      this._gl.uniform1i(this._useCustomImageLocation, 0);
    }
  }

  protected async setupUniforms(
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    init: EffectInit,
  ) {
    super.setupUniforms(gl, program, init);
    this._extraTexture = gl.createTexture();

    this._numMasksUniformLocation = gl.getUniformLocation(program, 'uNumMasks');
    gl.uniform1i(this._numMasksUniformLocation, this._numMasks);

    this._fillBgLocation = gl.getUniformLocation(program, 'uFill');
    gl.uniform1i(this._fillBgLocation, this._fillBg);
    
    // Add uniform for custom image toggle
    this._useCustomImageLocation = gl.getUniformLocation(program, 'uUseCustomImage');
    gl.uniform1i(this._useCustomImageLocation, this._useCustomImage ? 1 : 0);

    gl.uniform1i(
      gl.getUniformLocation(program, 'uEmojiTexture'),
      this._extraTextureUnit,
    );

    // We know the max number of textures, pre-allocate 3.
    this._maskTextures = preAllocateTextures(gl, 3);

    this._bitmap = []; // clear any previous pool of texture

    let response = await fetch(angeryIcon);
    let blob = await response.blob();
    const angery = await createImageBitmap(blob);

    response = await fetch(heartIcon);
    blob = await response.blob();
    const heart = await createImageBitmap(blob);

    response = await fetch(whistleIcon);
    blob = await response.blob();
    const whistle = await createImageBitmap(blob);

    this._bitmap = [angery, heart, whistle];
  }

  apply(form: CanvasForm, context: EffectFrameContext, _tracklets: Tracklet[]) {
    const gl = this._gl;
    const program = this._program;

    invariant(gl !== null, 'WebGL2 context is required');
    invariant(program !== null, 'Not WebGL program found');

    const iconIndex = Math.floor(this.variant / 2) % this._bitmap.length;

    if (!this._useCustomImage && this._bitmap === null) {
      return;
    }

    gl.clearColor(0.0, 0.0, 0.0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // dynamic uniforms per frame
    gl.uniform1i(this._numMasksUniformLocation, context.masks.length);
    gl.uniform1i(this._fillBgLocation, this.variant % 2 === 0 ? 0 : 1);

    // Update the custom image flag
    if (this._useCustomImageLocation) {
      gl.uniform1i(this._useCustomImageLocation, this._useCustomImage ? 1 : 0);
    }

    // Bind the texture to texture unit 1
    gl.activeTexture(gl.TEXTURE0 + this._extraTextureUnit);
    gl.bindTexture(gl.TEXTURE_2D, this._extraTexture);

    if (this._useCustomImage && this._customImage) {
      // Use the custom image if available
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        this._customImage.width,
        this._customImage.height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this._customImage,
      );

      // Use linear filtering for smoother scaling of photos
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    } else if (this._bitmap.length) {
      // Fall back to default icons
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.RGBA,
        this._bitmap[iconIndex].width,
        this._bitmap[iconIndex].height,
        0,
        gl.RGBA,
        gl.UNSIGNED_BYTE,
        this._bitmap[iconIndex],
      );

      // Use nearest filtering for crisp icon edges
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    context.masks.forEach((mask, index) => {
      const decodedMask = decode([mask.bitmap as RLEObject]);
      const maskData = decodedMask.data as Uint8Array;
      gl.activeTexture(gl.TEXTURE0 + index + this._masksTextureUnitStart);
      gl.bindTexture(gl.TEXTURE_2D, this._maskTextures[index]);

      const boundaries = normalizeBounds(
        mask.bounds[0],
        mask.bounds[1],
        context.width,
        context.height,
      );

      gl.uniform1i(
        gl.getUniformLocation(program, `uMaskTexture${index}`),
        index + this._masksTextureUnitStart,
      );
      gl.uniform4fv(gl.getUniformLocation(program, `bbox${index}`), boundaries);

      gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
      gl.texImage2D(
        gl.TEXTURE_2D,
        0,
        gl.LUMINANCE,
        context.height,
        context.width,
        0,
        gl.LUMINANCE,
        gl.UNSIGNED_BYTE,
        maskData,
      );
    });

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    // Unbind textures
    gl.bindTexture(gl.TEXTURE_2D, null);
    context.masks.forEach((_, index) => {
      gl.activeTexture(gl.TEXTURE0 + index + this._masksTextureUnitStart);
      gl.bindTexture(gl.TEXTURE_2D, null);
    });

    const ctx = form.ctx;
    invariant(this._canvas !== null, 'canvas is required');
    ctx.drawImage(this._canvas, 0, 0);
  }

  async cleanup(): Promise<void> {
    super.cleanup();

    if (this._gl != null) {
      // Delete mask textures to prevent memory leaks
      this._maskTextures.forEach(texture => {
        if (texture != null && this._gl != null) {
          this._gl.deleteTexture(texture);
        }
      });
      this._maskTextures = [];
    }
  }
}
