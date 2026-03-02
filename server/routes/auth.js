const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { config } = require('../config');
const { registerSchema, loginSchema, validateBody } = require('../schemas');
const { asyncHandler } = require('../middleware/errorHandler');

const prisma = new PrismaClient();

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

// Login
router.post('/login', validateBody(loginSchema), asyncHandler(async (req, res) => {
    const { email, password } = req.validatedBody;
    const user = await prisma.user.findUnique({ where: { email } });

    if (!user || !(await bcrypt.compare(password, user.password))) {
        return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
        { userId: user.id, role: user.role },
        config.jwtSecret,
        { expiresIn: '1h' }
    );

    res.json({
        token,
        user: { id: user.id, email: user.email, name: user.name, role: user.role }
    });
}));

module.exports = router;
