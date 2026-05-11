require('@testing-library/jest-dom');

const { TextDecoder, TextEncoder } = require('util');
const {
  ReadableStream,
  TransformStream,
  WritableStream,
} = require('stream/web');

if (!global.TextEncoder) {
  global.TextEncoder = TextEncoder;
}

if (!global.TextDecoder) {
  global.TextDecoder = TextDecoder;
}

if (!global.ReadableStream) {
  global.ReadableStream = ReadableStream;
}

if (!global.TransformStream) {
  global.TransformStream = TransformStream;
}

if (!global.WritableStream) {
  global.WritableStream = WritableStream;
}

const {
  fetch,
  Headers,
  Request,
  Response,
} = require('next/dist/compiled/@edge-runtime/primitives/fetch');

if (!global.fetch) {
  global.fetch = fetch;
}

if (!global.Headers) {
  global.Headers = Headers;
}

if (!global.Request) {
  global.Request = Request;
}

if (!global.Response) {
  global.Response = Response;
}
