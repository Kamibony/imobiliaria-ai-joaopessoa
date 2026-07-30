"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectSchema = exports.UnitSchema = exports.PropertySnapshotSchema = void 0;
const zod_1 = require("zod");
exports.PropertySnapshotSchema = zod_1.z.object({
    timestamp: zod_1.z.string(),
    price_brl: zod_1.z.number().nullable().optional(),
    price_per_m2_brl: zod_1.z.number().nullable().optional(),
    source: zod_1.z.string(),
});
exports.UnitSchema = zod_1.z.object({
    id: zod_1.z.string().nullable().optional(),
    unit_number: zod_1.z.string().nullable().optional(),
    area_m2: zod_1.z.number().nullable().optional(),
    bedrooms: zod_1.z.number().nullable().optional(),
    sun_orientation: zod_1.z.enum(['nascente', 'nascente_sul', 'sul', 'poente', '']).nullable().optional(),
    snapshots: zod_1.z.array(exports.PropertySnapshotSchema).optional(),
    assets: zod_1.z.object({
        floor_plans: zod_1.z.array(zod_1.z.string()).nullable().optional(),
        renders: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    }).nullable().optional(),
});
exports.ProjectSchema = zod_1.z.object({
    id: zod_1.z.string().nullable().optional(),
    needs_geocoding: zod_1.z.boolean().optional(),
    name: zod_1.z.string(),
    developer: zod_1.z.string().nullable().optional(),
    delivery_date: zod_1.z.string().nullable().optional(),
    status: zod_1.z.enum(['na_planta', 'em_construcao', 'pronto', '']).nullable().optional(),
    amenities: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    location: zod_1.z.object({
        neighborhood: zod_1.z.enum(['Cabo Branco', 'Tambau', 'Bessa', 'Tambaú']).nullable().optional(), // Allow Tambaú for fuzzy match
        position_to_sea: zod_1.z.enum(['beira_mar', 'quadra_mar', 'miolo', '']).nullable().optional(),
        distance_to_beach_meters: zod_1.z.number().nullable().optional(),
        coordinates: zod_1.z.object({
            lat: zod_1.z.number().nullable().optional(),
            lng: zod_1.z.number().nullable().optional(),
        }).nullable().optional(),
    }).nullable().optional(),
    ai_context: zod_1.z.object({
        target_persona: zod_1.z.object({
            'pt-BR': zod_1.z.array(zod_1.z.string()).nullable().optional(),
            'en': zod_1.z.array(zod_1.z.string()).nullable().optional(),
        }).nullable().optional(),
        investment_roi_estimated_percent: zod_1.z.number().nullable().optional(),
        local_advantage: zod_1.z.object({
            'pt-BR': zod_1.z.string().nullable().optional(),
            'en': zod_1.z.string().nullable().optional(),
        }).nullable().optional(),
    }).nullable().optional(),
    assets: zod_1.z.object({
        logo: zod_1.z.string().nullable().optional(),
        hero_images: zod_1.z.array(zod_1.z.string()).nullable().optional(),
        brochures: zod_1.z.array(zod_1.z.string()).nullable().optional(),
    }).nullable().optional(),
    resolution_state: zod_1.z.enum(['active', 'staged']).nullable().optional(),
    possible_matches: zod_1.z.array(zod_1.z.string()).nullable().optional(),
});
//# sourceMappingURL=schema.js.map