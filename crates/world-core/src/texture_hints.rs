use crate::ChunkTerrainTextureHints;
use crate::{
    checked_raster_size, render_hint_noise, texture_pattern_base_strength,
    texture_pattern_for_biome,
};

fn texture_noise(x: i32, y: i32, elevation: u8, moisture: u8, temperature: u8) -> u32 {
    let mut value = render_hint_noise(x, y, elevation);
    value = (value ^ moisture as u32).wrapping_mul(2_246_822_519);
    value = (value ^ temperature as u32).wrapping_mul(3_266_489_917);
    value ^ (value >> 16)
}

pub fn prepare_chunk_texture_hints(
    biomes: &[u8],
    elevation: &[u8],
    moisture: &[u8],
    temperature: &[u8],
    chunk_size: usize,
    origin_x: i32,
    origin_y: i32,
) -> ChunkTerrainTextureHints {
    let size = checked_raster_size(chunk_size, chunk_size, "chunk terrain texture hints");
    assert_eq!(biomes.len(), size, "biome length mismatch");
    assert_eq!(elevation.len(), size, "elevation length mismatch");
    assert_eq!(moisture.len(), size, "moisture length mismatch");
    assert_eq!(temperature.len(), size, "temperature length mismatch");

    let mut pattern = vec![0_u8; size];

    for local_y in 0..chunk_size {
        for local_x in 0..chunk_size {
            let index = local_y * chunk_size + local_x;
            let cell_elevation = elevation[index];
            let cell_moisture = moisture[index];
            let cell_temperature = temperature[index];
            let cell_pattern = texture_pattern_for_biome(biomes[index]);
            let noise = texture_noise(
                origin_x + local_x as i32,
                origin_y + local_y as i32,
                cell_elevation,
                cell_moisture,
                cell_temperature,
            );
            let climate =
                (cell_moisture as u16 + cell_temperature as u16 + cell_elevation as u16) / 24;
            let density = (texture_pattern_base_strength(cell_pattern) as u16
                + ((noise >> 24) & 0x2f) as u16
                + climate)
                / 12;
            pattern[index] = (cell_pattern << 4) | density.min(15) as u8;
        }
    }

    ChunkTerrainTextureHints { pattern }
}
