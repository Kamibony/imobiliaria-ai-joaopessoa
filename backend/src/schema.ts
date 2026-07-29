import { z } from 'zod';

export const PropertySnapshotSchema = z.object({
  timestamp: z.string(),
  price_brl: z.number().nullable().optional(),
  price_per_m2_brl: z.number().nullable().optional(),
  source: z.string(),
});

export const UnitSchema = z.object({
  id: z.string().nullable().optional(),
  unit_number: z.string().nullable().optional(),
  area_m2: z.number().nullable().optional(),
  bedrooms: z.number().nullable().optional(),
  sun_orientation: z.enum(['nascente', 'nascente_sul', 'sul', 'poente', '']).nullable().optional(),
  snapshots: z.array(PropertySnapshotSchema).optional(),
  assets: z.object({
    floor_plans: z.array(z.string()).nullable().optional(),
    renders: z.array(z.string()).nullable().optional(),
  }).nullable().optional(),
});

export const ProjectSchema = z.object({
  id: z.string().nullable().optional(),
  needs_geocoding: z.boolean().optional(),
  name: z.string(),
  developer: z.string().nullable().optional(),
  delivery_date: z.string().nullable().optional(),
  status: z.enum(['na_planta', 'em_construcao', 'pronto', '']).nullable().optional(),
  amenities: z.array(z.string()).nullable().optional(),
  location: z.object({
    neighborhood: z.enum(['Cabo Branco', 'Tambau', 'Bessa', 'Tambaú']).nullable().optional(), // Allow Tambaú for fuzzy match
    position_to_sea: z.enum(['beira_mar', 'quadra_mar', 'miolo', '']).nullable().optional(),
    distance_to_beach_meters: z.number().nullable().optional(),
    coordinates: z.object({
      lat: z.number().nullable().optional(),
      lng: z.number().nullable().optional(),
    }).nullable().optional(),
  }).nullable().optional(),
  ai_context: z.object({
    target_persona: z.object({
      'pt-BR': z.array(z.string()).nullable().optional(),
      'en': z.array(z.string()).nullable().optional(),
    }).nullable().optional(),
    investment_roi_estimated_percent: z.number().nullable().optional(),
    local_advantage: z.object({
      'pt-BR': z.string().nullable().optional(),
      'en': z.string().nullable().optional(),
    }).nullable().optional(),
  }).nullable().optional(),
  assets: z.object({
    logo: z.string().nullable().optional(),
    hero_images: z.array(z.string()).nullable().optional(),
    brochures: z.array(z.string()).nullable().optional(),
  }).nullable().optional(),
});
