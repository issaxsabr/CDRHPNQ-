import { z } from 'zod';
import DOMPurify from 'isomorphic-dompurify';
import { BusinessData } from '../types';
import { VALIDATION_CONFIG } from '../config';

// ===========================================
// CUSTOM VALIDATORS
// ===========================================

/**
 * Regex améliorée pour les numéros de téléphone nord-américains
 * Accepte: +1 (514) 555-1234, 514-555-1234, 5145551234, etc.
 */
const phoneRegex = /^(?:\+?1[-.\s]?)?(?:\(?[2-9]\d{2}\)?[-.\s]?)?[2-9]\d{2}[-.\s]?\d{4}$/;

/**
 * Regex pour les URLs (plus permissive que z.string().url())
 */
const urlRegex = /^(https?:\/\/)?([\w-]+\.)+[\w-]+(\/[\w-./?%&=]*)?$/i;

/**
 * Valide et nettoie une URL
 */
const sanitizeUrl = (url: string): string => {
  if (!url) return '';
  // Ajouter https:// si absent
  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
    return `https://${url}`;
  }
  return url;
};

// ===========================================
// ZOD SCHEMAS
// ===========================================

/**
 * Schéma pour les réseaux sociaux
 */
const SocialsSchema = z
  .object({
    facebook: z.string().max(200).optional(),
    instagram: z.string().max(200).optional(),
    linkedin: z.string().max(200).optional(),
    twitter: z.string().max(200).optional(),
  })
  .optional();

/**
 * Schéma pour un contact/décideur
 */
const ContactPersonSchema = z.object({
  name: z.string().min(1).max(100),
  title: z.string().max(100).optional(),
  email: z.string().email().optional(),
});

/**
 * Schéma de validation pour une mise à jour de champ unique
 */
const BusinessDataUpdateSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Le nom ne peut être vide.')
      .max(VALIDATION_CONFIG.MAX_NAME_LENGTH, `Le nom ne peut dépasser ${VALIDATION_CONFIG.MAX_NAME_LENGTH} caractères.`)
      .trim()
      .optional(),

    status: z.string().max(VALIDATION_CONFIG.MAX_GENERIC_LENGTH, 'Statut trop long.').optional(),

    address: z
      .string()
      .max(VALIDATION_CONFIG.MAX_ADDRESS_LENGTH, `L'adresse ne peut dépasser ${VALIDATION_CONFIG.MAX_ADDRESS_LENGTH} caractères.`)
      .optional(),

    phone: z
      .string()
      .regex(phoneRegex, 'Format de téléphone invalide. Ex: 514-555-1234')
      .or(z.literal(''))
      .optional(),

    hours: z.string().max(200, 'Horaires trop longs.').optional(),

    website: z
      .string()
      .regex(urlRegex, 'URL invalide.')
      .transform(sanitizeUrl)
      .or(z.literal(''))
      .optional(),

    category: z.string().max(VALIDATION_CONFIG.MAX_GENERIC_LENGTH, 'Catégorie trop longue.').optional(),

    email: z.string().email("Format d'email invalide.").or(z.literal('')).optional(),

    customField: z
      .string()
      .max(VALIDATION_CONFIG.MAX_MEMO_LENGTH, `Le mémo ne peut dépasser ${VALIDATION_CONFIG.MAX_MEMO_LENGTH} caractères.`)
      .optional(),

    // Champs supplémentaires pour la validation complète
    searchedTerm: z.string().max(200).optional(),
    sourceTitle: z.string().max(300).optional(),
    sourceUri: z.string().optional(),

    // Tableaux avec limites
    phones: z.array(z.string()).max(VALIDATION_CONFIG.MAX_PHONES_COUNT).optional(),
    emails: z.array(z.string().email()).max(VALIDATION_CONFIG.MAX_EMAILS_COUNT).optional(),

    // Objets complexes
    socials: SocialsSchema,
    decisionMakers: z.array(ContactPersonSchema).max(20).optional(),
  })
  .partial();

/**
 * Schéma complet pour la création d'un BusinessData
 */
export const BusinessDataSchema = z.object({
  id: z.string().uuid().optional(),
  projectId: z.string().uuid().optional(),
  name: z.string().min(1).max(VALIDATION_CONFIG.MAX_NAME_LENGTH),
  status: z.string().max(VALIDATION_CONFIG.MAX_GENERIC_LENGTH),
  address: z.string().max(VALIDATION_CONFIG.MAX_ADDRESS_LENGTH),
  phone: z.string(),
  hours: z.string(),
  phones: z.array(z.string()).max(VALIDATION_CONFIG.MAX_PHONES_COUNT).optional(),
  emails: z.array(z.string()).max(VALIDATION_CONFIG.MAX_EMAILS_COUNT).optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  category: z.string().optional(),
  sourceUri: z.string().optional(),
  sourceTitle: z.string().optional(),
  searchedTerm: z.string().optional(),
  socials: SocialsSchema,
  decisionMakers: z.array(ContactPersonSchema).optional(),
  customField: z.string().optional(),
  qualityScore: z.number().min(0).max(100).optional(),
});

// ===========================================
// VALIDATION FUNCTIONS
// ===========================================

/**
 * Liste des champs texte libre à sanitiser contre XSS
 */
const TEXT_FIELDS_TO_SANITIZE = ['name', 'status', 'address', 'hours', 'category', 'customField', 'searchedTerm', 'sourceTitle'];

/**
 * Valide et nettoie la valeur d'un champ spécifique d'une fiche entreprise.
 * @param field - La clé du champ à valider (ex: 'name', 'email').
 * @param value - La nouvelle valeur pour ce champ.
 * @returns Un objet contenant le champ validé et nettoyé.
 * @throws {z.ZodError} Si la validation échoue.
 */
export function validateAndSanitize(field: keyof BusinessData, value: unknown): Partial<BusinessData> {
  // 1. Validation de la structure et du format avec Zod
  const dataToValidate = { [field]: value };
  const validated = BusinessDataUpdateSchema.parse(dataToValidate);

  const validatedValue = validated[field as keyof typeof validated];

  // 2. Nettoyage contre les attaques XSS avec DOMPurify
  if (typeof validatedValue === 'string' && TEXT_FIELDS_TO_SANITIZE.includes(field)) {
    return { [field]: DOMPurify.sanitize(validatedValue) };
  }

  return validated;
}

/**
 * Valide un objet BusinessData complet
 * @param data - L'objet à valider
 * @returns L'objet validé
 * @throws {z.ZodError} Si la validation échoue
 */
export function validateBusinessData(data: unknown): BusinessData {
  return BusinessDataSchema.parse(data) as BusinessData;
}

/**
 * Valide un objet BusinessData sans lever d'exception
 * @param data - L'objet à valider
 * @returns Un objet avec success et data ou error
 */
export function safeValidateBusinessData(data: unknown): { success: true; data: BusinessData } | { success: false; error: z.ZodError } {
  const result = BusinessDataSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as BusinessData };
  }
  return { success: false, error: result.error };
}

/**
 * Sanitise tous les champs texte d'un objet BusinessData
 * @param data - L'objet à sanitiser
 * @returns L'objet avec les champs texte sanitisés
 */
export function sanitizeBusinessData(data: BusinessData): BusinessData {
  const sanitized = { ...data };

  for (const field of TEXT_FIELDS_TO_SANITIZE) {
    const key = field as keyof BusinessData;
    if (typeof sanitized[key] === 'string') {
      (sanitized as Record<string, unknown>)[key] = DOMPurify.sanitize(sanitized[key] as string);
    }
  }

  return sanitized;
}

/**
 * Obtient un message d'erreur lisible à partir d'une ZodError
 * @param error - L'erreur Zod
 * @returns Message d'erreur en français
 */
export function getValidationErrorMessage(error: z.ZodError): string {
  const firstError = error.errors[0];
  if (!firstError) return 'Erreur de validation.';

  const path = firstError.path.join('.');
  return `${path ? `${path}: ` : ''}${firstError.message}`;
}

export default {
  validateAndSanitize,
  validateBusinessData,
  safeValidateBusinessData,
  sanitizeBusinessData,
  getValidationErrorMessage,
  BusinessDataSchema,
};
