"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PropertySchema = exports.PropertySnapshotSchema = void 0;
const zod_1 = require("zod");
exports.PropertySnapshotSchema = zod_1.z.object({
    timestamp: zod_1.z.string(),
    price_brl: zod_1.z.number().nullable(),
    price_per_m2_brl: zod_1.z.number().nullable(),
    status: zod_1.z.enum(['na_planta', 'em_construcao', 'pronto']),
    source: zod_1.z.string(),
});
exports.PropertySchema = zod_1.z.object({
    id: zod_1.z.string(),
    needs_geocoding: zod_1.z.boolean().optional(),
    basic_info: zod_1.z.object({
        title: zod_1.z.string(),
        developer: zod_1.z.string().nullable(),
        delivery_date: zod_1.z.string().nullable(),
    }),
    location: zod_1.z.object({
        neighborhood: zod_1.z.enum(['Cabo Branco', 'Tambau', 'Bessa', 'Tambaú']), // Allow Tambaú for fuzzy match
        position_to_sea: zod_1.z.enum(['beira_mar', 'quadra_mar', 'miolo']),
        distance_to_beach_meters: zod_1.z.number(),
        coordinates: zod_1.z.object({
            lat: zod_1.z.number().nullable(),
            lng: zod_1.z.number().nullable(),
        }),
    }),
    features: zod_1.z.object({
        area_m2: zod_1.z.number().nullable(),
        sun_orientation: zod_1.z.enum(['nascente', 'nascente_sul', 'sul', 'poente']),
        bedrooms: zod_1.z.number().nullable(),
    }),
    snapshots: zod_1.z.array(exports.PropertySnapshotSchema),
    ai_context: zod_1.z.object({
        target_persona: zod_1.z.object({
            'pt-BR': zod_1.z.array(zod_1.z.string()),
            'en': zod_1.z.array(zod_1.z.string()),
        }),
        investment_roi_estimated_percent: zod_1.z.number(),
        local_advantage: zod_1.z.object({
            'pt-BR': zod_1.z.string(),
            'en': zod_1.z.string(),
        }),
    }),
});
//# sourceMappingURL=schema.js.map