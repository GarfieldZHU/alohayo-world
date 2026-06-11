use wasm_bindgen::prelude::*;

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

    if elevation < 0.43 {
        0
    } else if elevation < 0.47 {
        1
    } else if elevation > 0.82 && temperature < 0.42 {
        7
    } else if elevation > 0.78 {
        6
    } else if moisture > 0.70 && elevation < 0.58 {
        5
    } else if temperature > 0.68 && moisture < 0.42 {
        4
    } else if moisture > 0.57 {
        3
    } else {
        2
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
}
