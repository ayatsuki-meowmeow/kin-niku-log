import { z } from 'zod'

export const createUserSchema = z.object({
  name: z.string().min(1).max(255),
  email: z.string().email().max(255),
})

export type CreateUserInput = z.infer<typeof createUserSchema>
