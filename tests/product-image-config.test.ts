import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getImgProps } from 'next/dist/shared/lib/get-img-props.js';
import { imageConfigDefault } from 'next/dist/shared/lib/image-config.js';
import loaderModule from 'next/dist/shared/lib/image-loader.js';
import nextConfig from '../next.config.ts';

test('renders uploaded product images using the configured Next image loader', () => {
  const src = 'https://shop-qr-payment.media.nhonhoadev.id.vn/products/chuot-khong-day.webp';
  const { props } = getImgProps({ src, alt: 'Chuột không dây', width: 400, height: 400 }, {
    imgConf: { ...imageConfigDefault, ...nextConfig.images },
    defaultLoader: loaderModule.default,
  });
  assert.ok(props.src.startsWith('/_next/image?'));
  assert.equal(new URL(props.src, 'http://localhost').searchParams.get('url'), src);
});
