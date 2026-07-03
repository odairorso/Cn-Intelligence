// Environment setup for testing
process.env.DATABASE_URL = 'postgresql://localhost:5432/mock';
process.env.JWT_SECRET = 'test-jwt-secret-key-12345';
process.env.ENABLE_LEGACY_SECURITY_TOKEN = 'false';
process.env.SECURITY_TOKEN = 'legacy-token-value';
process.env.APP_UID = 'odair';
