import { z } from 'zod';

export const PropertySnapshotSchema = z.object({
  timestamp: z.string(),
  price_brl: z.number().nullable(),
  price_per_m2_brl: z.number().nullable(),
  source: z.string(),
});

export const UnitSchema = z.object({
  id: z.string(),
  unit_number: z.string().nullable(),
  area_m2: z.number().nullable(),
  bedrooms: z.number().nullable(),
  sun_orientation: z.enum(['nascente', 'nascente_sul', 'sul', 'poente', '']).nullable().optional(),
  snapshots: z.array(PropertySnapshotSchema),
});

export const ProjectSchema = z.object({
  id: z.string(),
  needs_geocoding: z.boolean().optional(),
  name: z.string(),
  developer: z.string().nullable(),
  delivery_date: z.string().nullable(),
  status: z.enum(['na_planta', 'em_construcao', 'pronto', '']).nullable().optional(),
  amenities: z.array(z.string()).optional(),
  location: z.object({
    neighborhood: z.enum(['Cabo Branco', 'Tambau', 'Bessa', 'Tambaú']), // Allow Tambaú for fuzzy match
    position_to_sea: z.enum(['beira_mar', 'quadra_mar', 'miolo', '']).nullable().optional(),
    distance_to_beach_meters: z.number().nullable(),
    coordinates: z.object({
      lat: z.number().nullable(),
      lng: z.number().nullable(),
    }),
  }),
  ai_context: z.object({
    target_persona: z.object({
      'pt-BR': z.array(z.string()),
      'en': z.array(z.string()),
    }),
    investment_roi_estimated_percent: z.number().nullable(),
    local_advantage: z.object({
      'pt-BR': z.string(),
      'en': z.string(),
    }),
  }).optional(),
});
