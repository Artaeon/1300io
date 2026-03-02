// Set test environment variables before any module loads
process.env.JWT_SECRET = 'test-secret-key-at-least-16-characters-long';
process.env.DATABASE_URL = 'file:./test.db';
process.env.NODE_ENV = 'test';
process.env.PORT = '0'; // Use random port
process.env.FRONTEND_URL = 'http://localhost:5173';
process.env.UPLOAD_DIR = './test-uploads';
