
import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { BusinessData } from '../types';

// Schéma de validation pour une mise à jour de champ unique.
// Il est partiel car nous ne validons qu'un champ à la fois.
const BusinessDataUpdateSchema = z.object({
  name: z.string().min(1, "Le nom ne peut être vide.").max(200, "Le nom est trop long.").trim().optional(),
  status: z.string().max(100).optional(),
  address: z.string().max(300).optional(),
  phone: z.string().regex(/^\+?[\d\s()-]{7,20}$/, "Format de téléphone invalide.").or(z.literal('')).optional(),
  hours: z.string().max(200).optional(),
  website: z.string().url("URL invalide.").or(z.literal('')).optional(),
  category: z.string().max(100).optional(),
  email: z.string().email("Format d'email invalide.").or(z.literal('')).optional(),
  customField: z.string().max(500, "Le mémo est trop long.").optional()
}).partial();


/**
 * Valide et nettoie la valeur d'un champ spécifique d'une fiche entreprise.
 * @param field - La clé du champ à valider (ex: 'name', 'email').
 * @param value - La nouvelle valeur pour ce champ.
 * @returns Un objet contenant le champ validé et nettoyé.
 * @throws {z.ZodError} Si la validation échoue.
 */
export function validateAndSanitize(
  field: keyof BusinessData, 
  value: any
): { [key in keyof BusinessData]?: any } {
  
  // 1. Validation de la structure et du format avec Zod
  const dataToValidate = { [field]: value };
  const validated = BusinessDataUpdateSchema.parse(dataToValidate);

  const validatedValue = validated[field];

  // 2. Nettoyage contre les attaques XSS avec DOMPurify
  if (typeof validatedValue === 'string') {
    // On ne nettoie que les champs de texte libre.
    // Les emails, URLs et téléphones ont déjà des formats stricts
    // et DOMPurify pourrait altérer leur valeur.
    if (['name', 'status', 'address', 'hours', 'category', 'customField'].includes(field)) {
      return { [field]: DOMPurify.sanitize(validatedValue) };
    }
  }
  
  return validated;
}