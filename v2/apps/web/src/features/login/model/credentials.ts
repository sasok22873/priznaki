import { z } from 'zod';

export const credentialsSchema = z.object({
  email: z.string().trim().email('Введите корректную почту'),
  password: z.string().min(6, 'Минимум 6 символов'),
});
export type Credentials = z.infer<typeof credentialsSchema>;
