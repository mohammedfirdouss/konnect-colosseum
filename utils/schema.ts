import * as yup from 'yup';

const emailSchema = yup
  .string()
  .required('Email is required')
  .email('Please enter a valid email address');

const passwordSchema = yup
  .string()
  .required('Password is required')
  .min(8, 'Password must be at least 8 characters long');

export const registrationSchema = yup.object({
  name: yup
    .string()
    .required('Full name is required')
    .min(2, 'Name must be at least 2 characters long'),
  
  email: emailSchema,
  
  phone: yup
    .string()
    .required('Phone number is required'),
  
  password: passwordSchema,
  
  confirmPassword: yup
    .string()
    .required('Please confirm your password')
    .oneOf([yup.ref('password')], 'Passwords must match'),
});

export const loginSchema = yup.object({
  email: emailSchema,
  
  password: yup
    .string()
    .required('Password is required'),
});
