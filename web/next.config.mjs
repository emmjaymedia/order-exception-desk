const api = process.env.BACKEND_URL || 'http://127.0.0.1:8000';

export default {
  async rewrites() {
    if (process.env.NEXT_PUBLIC_STANDALONE_DEMO === 'true') return [];
    return [{ source: '/api/:path*', destination: api + '/:path*' }];
  },
};
