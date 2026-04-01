// *************** IMPORT CORE ***************
'use strict';

// *************** IMPORT LIBRARY ***************
const Joi = require('joi');

// *************** IMPORT MODULE ***************

// *************** VARIABLES ***************
const LoginSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(8).required(),
});

const RegisterSchema = Joi.object({
  email: Joi.string().email({ tlds: { allow: false } }).required(),
  password: Joi.string().min(8).required(),
  full_name: Joi.string().allow('').optional(),
  role: Joi.string().valid('admin', 'user').optional(),
});

// *************** FUNCTIONS ***************
/**
 * Validates the body for POST /auth/login.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateLogin(input) {
  return LoginSchema.validate(input, { abortEarly: false });
}

/**
 * Validates the body for POST /auth/register.
 *
 * @param {Object} input
 * @returns {{ error?: import('joi').ValidationError, value: Object }}
 */
function ValidateRegister(input) {
  return RegisterSchema.validate(input, { abortEarly: false });
}

// *************** EXPORT MODULE ***************
module.exports = { ValidateLogin, ValidateRegister };
