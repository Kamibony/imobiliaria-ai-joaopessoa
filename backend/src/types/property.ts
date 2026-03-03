export interface PropertySnapshot {
  timestamp: Date;
  price_brl: number | null;
  price_per_m2_brl: number | null;
  status: 'na_planta' | 'em_construcao' | 'pronto';
  source: string; // e.g., 'admin_upload', 'scraper'
}

export interface Property {
  id: string; // unique identifier
  basic_info: {
    title: string;
    developer: string | null;
    delivery_date: Date | null; // corresponds to timestamp
  };
  location: {
    neighborhood: 'Cabo Branco' | 'Tambau';
    position_to_sea: 'beira_mar' | 'quadra_mar' | 'miolo';
    distance_to_beach_meters: number;
    coordinates: {
      lat: number;
      lng: number;
    };
  };
  features: {
    area_m2: number | null;
    sun_orientation: 'nascente' | 'nascente_sul' | 'sul' | 'poente';
    bedrooms: number | null;
  };
  snapshots: PropertySnapshot[];
  ai_context: {
    target_persona: string[];
    investment_roi_estimated_percent: number;
    local_advantage: string; // System prompt context for Gemini
  };
}
