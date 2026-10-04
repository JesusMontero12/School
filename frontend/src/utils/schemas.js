import { z } from 'zod';

export const email = z.string().trim().min(1, 'Escribe tu correo').email('Ese correo no parece válido');

export const newPassword = z.string()
  .min(10, 'Mínimo 10 caracteres')
  .regex(/[a-z]/, 'Incluye una minúscula')
  .regex(/[A-Z]/, 'Incluye una mayúscula')
  .regex(/\d/, 'Incluye un número');

export const passwordHint = 'Mínimo 10 caracteres, con mayúscula, minúscula y número.';
