//! Shared dimension checks for coarse Wasm batches.

pub fn checked_raster_size(width: usize, height: usize, label: &str) -> usize {
    assert!(width > 0 && height > 0, "{label} cannot be empty");
    width
        .checked_mul(height)
        .unwrap_or_else(|| panic!("{label} dimensions overflow"))
}
