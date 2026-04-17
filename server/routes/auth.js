const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const prisma = require('../lib/prisma');
const { config } = require('../config');
const { registerSchema, loginSchema, validateBody } = require('../schemas');
const { asyncHandler } = require('../middleware/errorHandler');

const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY_DAYS = 7;

function generateAccessToken(user) {
    return jwt.sign(
        { userId: user.id, role: user.role, organizationId: user.organizationId || null },
        config.jwtSecret,
        { expiresIn: ACCESS_TOKEN_EXPIRY }
    );
}

function generateRefreshToken() {
    return crypto.randomBytes(48).toString('base64url');
}

// Register
router.post('/register', validateBody(registerSchema), asyncHandler(async (req, res) => {
    const { email, password, name } = req.validatedBody;

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
        return res.status(409).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
        data: { email, password: hashedPassword, name, role: 'INSPECTOR' }
    });

    res.status(201).json({ message: 'User created', user: { id: user.id, email: user.email, name: user.name, role: user.role } });
}));

// Login — returns accessToken (15min) + refreshToken (7 days)
router.post('/login', validateBody(loginSchema), asyncHandler(async (req, res) => {
    const { email, password } = req.validatedBody;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
        data: { token: refreshToken, userId: user.id, expiresAt }
    });

    res.json({
        token: accessToken,
        refreshToken,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
}));

// Refresh — validate refresh token, rotate, return new pair
router.post('/refresh', asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
    }

    const stored = await prisma.refreshToken.findUnique({
        where: { token: refreshToken },
        include: { user: true }
    });

    if (!stored) {
        return res.status(401).json({ error: 'Invalid refresh token' });
    }

    // Delete the used token (single-use rotation)
    await prisma.refreshToken.delete({ where: { id: stored.id } });

    if (stored.expiresAt < new Date()) {
        return res.status(401).json({ error: 'Refresh token expired' });
    }

    // Issue new pair
    const newAccessToken = generateAccessToken(stored.user);
    const newRefreshToken = generateRefreshToken();

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    await prisma.refreshToken.create({
        data: { token: newRefreshToken, userId: stored.user.id, expiresAt }
    });

    res.json({
        token: newAccessToken,
        refreshToken: newRefreshToken,
        user: { id: stored.user.id, email: stored.user.email, name: stored.user.name, role: stored.user.role }
    });
}));

// Logout — invalidate refresh token
router.post('/logout', asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    if (refreshToken) {
        await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
    }
    res.json({ message: 'Logged out' });
}));

module.exports = router;
