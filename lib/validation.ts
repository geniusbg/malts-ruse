import { z } from 'zod';

// User validation schema
export const userSchema = z.object({
  email: z.string().email({ message: 'Invalid email format' }).min(5).max(255),
  password: z.string().min(6, { message: 'Password must be at least 6 characters' }),
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }).max(100),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'STAFF']),
});

// Update user schema (password optional for updates)
export const updateUserSchema = z.object({
  email: z.string().email().min(5).max(255).optional(),
  password: z.string().min(6).optional(),
  name: z.string().min(2).max(100).optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'STAFF']).optional(),
  isActive: z.boolean().optional(),
  canSeeAllTables: z.boolean().optional(),
});

// Helper to validate with custom error handling
export function validateUserInput<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): { success: true; data: z.infer<T> } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  // Handle ZodError properly
  const errorMessages = result.error.issues.map((err) => 
    `${err.path.join('.')}: ${err.message}`
  );
  
  return {
    success: false,
    errors: errorMessages,
  };
}

