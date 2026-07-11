use wasm_bindgen::prelude::*;

const BIOME_DEEP_OCEAN: u8 = 0;
const BIOME_OCEAN: u8 = 1;
const BIOME_SHALLOW_SEA: u8 = 2;
const BIOME_LAKE: u8 = 4;
const BIOME_FOREST: u8 = 9;
const BIOME_WETLAND: u8 = 11;
const BIOME_HIGHLAND: u8 = 12;
const BIOME_BARE_ROCK: u8 = 13;
const BIOME_MOUNTAIN: u8 = 14;
const BIOME_RAINFOREST: u8 = 18;

const CLOSE_DETAIL_WATER: u8 = 1;
const CLOSE_DETAIL_FOREST: u8 = 2;
const CLOSE_DETAIL_MOUNTAIN: u8 = 3;
const CLOSE_DETAIL_WETLAND: u8 = 4;
const CLOSE_DETAIL_GENERIC: u8 = 5;

#[wasm_bindgen(getter_with_clone)]
pub struct ChunkBaseLayers {
    pub elevation: Vec<u8>,
    pub moisture: Vec<u8>,
    pub temperature: Vec<u8>,
}

#[wasm_bindgen]
pub fn hash_seed(seed: &str) -> u32 {
    seed.bytes().fold(2_166_136_261_u32, |hash, value| {
        (hash ^ value as u32).wrapping_mul(16_777_619)
    })
}

#[wasm_bindgen]
pub fn classify_biome(elevation: u8, moisture: u8, temperature: u8) -> u8 {
    let elevation = elevation as f32 / 255.0;
    let moisture = moisture as f32 / 255.0;
    let temperature = temperature as f32 / 255.0;

    if elevation < 0.20 {
        0
    } else if elevation < 0.34 {
        1
    } else if elevation < 0.43 {
        2
    } else if elevation < 0.47 {
        3
    } else if elevation > 0.83 && temperature < 0.46 {
        13
    } else if elevation > 0.82 {
        12
    } else if elevation > 0.74 && moisture < 0.55 {
        11
    } else if elevation > 0.66 {
        10
    } else if moisture > 0.72 && elevation < 0.56 {
        9
    } else if temperature > 0.68 && moisture < 0.42 {
        8
    } else if moisture > 0.58 {
        7
    } else if elevation < 0.54 {
        5
    } else {
        6
    }
}

fn random2d(x: i32, y: i32, seed: u32) -> f64 {
    let mut value = (x as u32)
        .wrapping_mul(374_761_393)
        .wrapping_add((y as u32).wrapping_mul(668_265_263))
        .wrapping_add(seed.wrapping_mul(69_069));
    value ^= value >> 13;
    value = value.wrapping_mul(1_274_126_177);
    (value ^ (value >> 16)) as f64 / u32::MAX as f64
}

fn smoothstep(value: f64) -> f64 {
    value * value * (3.0 - 2.0 * value)
}

fn value_noise(x: i32, y: i32, scale: f64, seed: u32) -> f64 {
    let px = x as f64 / scale;
    let py = y as f64 / scale;
    let x0 = px.floor() as i32;
    let y0 = py.floor() as i32;
    let tx = smoothstep(px - x0 as f64);
    let ty = smoothstep(py - y0 as f64);
    let a = random2d(x0, y0, seed);
    let b = random2d(x0.wrapping_add(1), y0, seed);
    let c = random2d(x0, y0.wrapping_add(1), seed);
    let d = random2d(x0.wrapping_add(1), y0.wrapping_add(1), seed);
    let top = a + (b - a) * tx;
    let bottom = c + (d - c) * tx;
    top + (bottom - top) * ty
}

fn octave_noise(x: i32, y: i32, seed: u32) -> f64 {
    value_noise(x, y, 46.0, seed) * 0.52
        + value_noise(x, y, 22.0, seed.wrapping_add(101)) * 0.28
        + value_noise(x, y, 10.0, seed.wrapping_add(211)) * 0.14
        + value_noise(x, y, 5.0, seed.wrapping_add(307)) * 0.06
}

fn clamp01(value: f64) -> f64 {
    value.clamp(0.0, 1.0)
}

fn stream_latitude(global_y: i32) -> f64 {
    let wrapped = ((global_y as f64 / 640.0).rem_euclid(2.0) - 1.0).abs();
    1.0 - wrapped
}

fn stream_elevation_value(global_x: i32, global_y: i32, seed: u32) -> f64 {
    let macro_value = value_noise(global_x, global_y, 360.0, seed.wrapping_add(1301));
    let continents = value_noise(global_x, global_y, 180.0, seed.wrapping_add(1709));
    let fine = octave_noise(global_x, global_y, seed);
    let ridges = (value_noise(global_x, global_y, 88.0, seed.wrapping_add(2503)) * 2.0 - 1.0).abs();
    clamp01(macro_value * 0.46 + continents * 0.26 + fine * 0.38 - ridges * 0.14 - 0.12)
}

fn stream_moisture_value(global_x: i32, global_y: i32, seed: u32, elevation: f64) -> f64 {
    let rain = value_noise(
        global_x.wrapping_add(710),
        global_y.wrapping_sub(390),
        92.0,
        seed.wrapping_add(503),
    );
    let saturation = value_noise(
        global_x.wrapping_sub(180),
        global_y.wrapping_add(820),
        34.0,
        seed.wrapping_add(1187),
    );
    clamp01(rain * 0.64 + saturation * 0.22 + (1.0 - elevation) * 0.18)
}

fn stream_temperature_value(global_x: i32, global_y: i32, seed: u32, elevation: f64) -> f64 {
    let latitude = stream_latitude(global_y);
    let climate = value_noise(global_x, global_y, 54.0, seed.wrapping_add(907));
    clamp01(latitude * 0.72 + climate * 0.24 - (elevation - 0.68).max(0.0) * 0.78)
}

#[wasm_bindgen]
pub fn generate_chunk_base_layers(
    seed: u32,
    chunk_size: usize,
    origin_x: i32,
    origin_y: i32,
) -> ChunkBaseLayers {
    let size = chunk_size * chunk_size;
    let mut elevation = vec![0_u8; size];
    let mut moisture = vec![0_u8; size];
    let mut temperature = vec![0_u8; size];

    for local_y in 0..chunk_size {
        for local_x in 0..chunk_size {
            let index = local_y * chunk_size + local_x;
            let global_x = origin_x.wrapping_add(local_x as i32);
            let global_y = origin_y.wrapping_add(local_y as i32);
            let elevation_value = stream_elevation_value(global_x, global_y, seed);
            let moisture_value = stream_moisture_value(global_x, global_y, seed, elevation_value);
            let temperature_value =
                stream_temperature_value(global_x, global_y, seed, elevation_value);
            elevation[index] = (elevation_value * 255.0).round() as u8;
            moisture[index] = (moisture_value * 255.0).round() as u8;
            temperature[index] = (temperature_value * 255.0).round() as u8;
        }
    }

    ChunkBaseLayers {
        elevation,
        moisture,
        temperature,
    }
}

#[wasm_bindgen(getter_with_clone)]
pub struct ChunkRenderHints {
    pub noise: Vec<u32>,
    pub east_boundary_mask: Vec<u8>,
    pub south_boundary_mask: Vec<u8>,
    pub regional_detail_mask: Vec<u8>,
    pub close_detail_kind: Vec<u8>,
    pub detail_offset_x: Vec<u8>,
    pub detail_offset_y: Vec<u8>,
}

fn render_hint_noise(x: i32, y: i32, salt: u8) -> u32 {
    let mut value = ((x + salt as i32).wrapping_mul(374_761_393))
        ^ ((y - salt as i32).wrapping_mul(668_265_263));
    value = (value ^ (value >> 13)).wrapping_mul(1_274_126_177);
    (value ^ (value >> 16)) as u32
}

fn close_detail_kind_for_biome(biome: u8) -> u8 {
    match biome {
        BIOME_DEEP_OCEAN | BIOME_OCEAN | BIOME_SHALLOW_SEA | BIOME_LAKE => CLOSE_DETAIL_WATER,
        BIOME_FOREST | BIOME_RAINFOREST => CLOSE_DETAIL_FOREST,
        BIOME_MOUNTAIN | BIOME_BARE_ROCK | BIOME_HIGHLAND => CLOSE_DETAIL_MOUNTAIN,
        BIOME_WETLAND => CLOSE_DETAIL_WETLAND,
        _ => CLOSE_DETAIL_GENERIC,
    }
}

#[wasm_bindgen]
pub fn prepare_chunk_render_hints(
    biomes: &[u8],
    elevation: &[u8],
    chunk_size: usize,
    origin_x: i32,
    origin_y: i32,
) -> ChunkRenderHints {
    let size = chunk_size * chunk_size;
    let mut noise = vec![0_u32; size];
    let mut east_boundary_mask = vec![0_u8; size];
    let mut south_boundary_mask = vec![0_u8; size];
    let mut regional_detail_mask = vec![0_u8; size];
    let mut close_detail_kind = vec![0_u8; size];
    let mut detail_offset_x = vec![0_u8; size];
    let mut detail_offset_y = vec![0_u8; size];

    for local_y in 0..chunk_size {
        for local_x in 0..chunk_size {
            let index = local_y * chunk_size + local_x;
            let cell_noise = render_hint_noise(
                origin_x + local_x as i32,
                origin_y + local_y as i32,
                elevation[index],
            );
            noise[index] = cell_noise;
            let biome = biomes[index];
            if local_x + 1 < chunk_size && biomes[index + 1] != biome {
                east_boundary_mask[index] = 1;
            }
            if local_y + 1 < chunk_size && biomes[index + chunk_size] != biome {
                south_boundary_mask[index] = 1;
            }
            if cell_noise % 11 == 0 {
                regional_detail_mask[index] = 1;
            }
            if cell_noise % 7 == 0 {
                close_detail_kind[index] = close_detail_kind_for_biome(biome);
                detail_offset_x[index] = ((cell_noise >> 7) & 0xff) as u8;
                detail_offset_y[index] = ((cell_noise >> 11) & 0xff) as u8;
            }
        }
    }

    ChunkRenderHints {
        noise,
        east_boundary_mask,
        south_boundary_mask,
        regional_detail_mask,
        close_detail_kind,
        detail_offset_x,
        detail_offset_y,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seed_hash_is_stable() {
        assert_eq!(hash_seed("alohayo"), 2_244_857_266);
    }

    #[test]
    fn ocean_classification_is_stable() {
        assert_eq!(classify_biome(50, 120, 140), 0);
    }

    #[test]
    fn chunk_render_hints_are_stable() {
        let biomes = vec![0, 0, 9, 9, 14, 14, 11, 7, 4];
        let elevation = vec![42, 43, 80, 81, 190, 191, 110, 96, 20];
        let hints = prepare_chunk_render_hints(&biomes, &elevation, 3, -2, 5);
        assert_eq!(hints.noise.len(), 9);
        assert_eq!(hints.east_boundary_mask, vec![0, 1, 0, 1, 0, 0, 1, 1, 0]);
        assert_eq!(hints.south_boundary_mask, vec![1, 1, 1, 1, 1, 1, 0, 0, 0]);
        assert!(hints
            .regional_detail_mask
            .iter()
            .zip(hints.close_detail_kind.iter())
            .any(|(regional, close)| *regional > 0 || *close > 0));
    }

    #[test]
    fn chunk_base_layers_are_deterministic() {
        let first = generate_chunk_base_layers(hash_seed("alohayo"), 16, -48, 80);
        let second = generate_chunk_base_layers(hash_seed("alohayo"), 16, -48, 80);
        assert_eq!(first.elevation, second.elevation);
        assert_eq!(first.moisture, second.moisture);
        assert_eq!(first.temperature, second.temperature);
        assert_eq!(first.elevation.len(), 256);
    }
}
