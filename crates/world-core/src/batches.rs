//! Typed-array batch outputs crossing the Rust/Wasm boundary.
//!
//! Each vector is owned by the returned Wasm object. The worker validates lengths before
//! using it and transfers the JS typed-array buffers back to the engine.

use wasm_bindgen::prelude::*;

#[wasm_bindgen(getter_with_clone)]
pub struct ChunkBaseLayers {
    pub elevation: Vec<u8>,
    pub moisture: Vec<u8>,
    pub temperature: Vec<u8>,
}

#[wasm_bindgen(getter_with_clone)]
pub struct HydrologyCoreRaster {
    pub width: u32,
    pub height: u32,
    pub raw_elevation: Vec<f32>,
    pub filled_elevation: Vec<f32>,
    pub water: Vec<u8>,
    pub slope: Vec<u8>,
    pub flow_direction: Vec<i8>,
    pub flow_accumulation: Vec<u32>,
    pub watershed: Vec<u32>,
    pub depression: Vec<u8>,
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
