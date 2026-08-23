import { z } from 'zod';
import { Request, Response, NextFunction } from 'express';

// Validation middleware
export const validateData = (schema: z.AnyZodObject | z.ZodEffects<z.AnyZodObject>) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      req.body = await schema.parseAsync(req.body);
      next();
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({
          error: "Dados inválidos enviados.",
          details: error.issues.map(issue => ({
            campo: issue.path.join('.'),
            mensagem: issue.message
          }))
        });
      }
      return res.status(500).json({ error: "Erro interno de validação" });
    }
  };
};

export const PasswordSchema = z.string()
  .min(8, "A senha deve ter no mínimo 8 caracteres")
  .max(100, "A senha deve ter no máximo 100 caracteres")
  .regex(/[A-Z]/, "A senha deve conter pelo menos uma letra maiúscula")
  .regex(/[a-z]/, "A senha deve conter pelo menos uma letra minúscula")
  .regex(/[0-9]/, "A senha deve conter pelo menos um número")
  .regex(/[\W_]/, "A senha deve conter pelo menos um caractere especial");

export const RegisterSchema = z.object({
  username: z.string().min(3, "Mínimo de 3 caracteres").max(20, "Máximo de 20 caracteres").regex(/^[a-zA-Z0-9_]+$/, "Apenas letras, números e underline"),
  email: z.string().email("E-mail inválido").optional().or(z.literal('')),
  password: PasswordSchema
});

export const RecoverResetSchema = z.object({
  email: z.string().email("E-mail inválido"),
  code: z.string().min(6, "Código inválido"),
  newPassword: PasswordSchema
});

export const LoginSchema = z.object({
  username: z.string().min(1, "Username/E-mail é obrigatório").max(100),
  password: z.string().min(1, "Senha é obrigatória").max(100),
  verificationCode: z.string().optional()
});

export const PromotionSchema = z.object({
  url: z.string().url("A URL deve ser válida").max(1000),
  durationMinutes: z.number().int().min(1, "Duração mínima").max(1440, "Duração máxima")
});

export const SavedCardSchema = z.object({
  cardholderName: z.string().min(2, "Nome incompleto").max(100, "Nome muito longo"),
  cardNumber: z.string().min(13).max(19).regex(/^\d+$/, "Cartão deve conter apenas números"),
  expirationMonth: z.string().regex(/^(0[1-9]|1[0-2])$/, "Mês inválido"),
  expirationYear: z.string().regex(/^\d{2,4}$/, "Ano inválido"),
  brand: z.string().max(30).optional()
});
