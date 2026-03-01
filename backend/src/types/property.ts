export interface PropertySnapshot {
  timestamp: Date;
  price_brl: number;
  price_per_m2_brl: number;
  status: 'na_planta' | 'em_construcao' | 'pronto';
  source: string; // e.g., 'admin_upload', 'scraper'
}

export interface Property {
  id: string; // unique identifier
  basic_info: {
    title: string;
    developer: string;
    delivery_date: Date; // corresponds to timestamp
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
    area_m2: number;
    sun_orientation: 'nascente' | 'nascente_sul' | 'sul' | 'poente';
    bedrooms: number;
  };
  snapshots: PropertySnapshot[];
  ai_context: {
    target_persona: string[];
    investment_roi_estimated_percent: number;
    local_advantage: string; // System prompt context for Gemini
  };
}
