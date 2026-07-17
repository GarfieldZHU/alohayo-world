# Character and Map Interactions

Terrain interaction is evaluated from stable terrain IDs, active surface effects,
equipment capability tags, and background roles. The result is a pure value containing
movement, stamina, control, and exposure modifiers. Rendering and input do not own these
rules.

## Examples

- A marsh raises movement and stamina costs; waterproof boots or a river-warden
  background can mitigate, but not erase, the penalty.
- Snow and glacier terrain add cold exposure; insulated equipment reduces exposure while
  traction equipment improves control.
- Mountains reward climbing capability and pass knowledge. Roads can supersede the local
  movement modifier through the road module without changing the underlying terrain.
- Open ocean remains blocked without swimming, boat, amphibious, or flight capability.
- Desert travel couples terrain heat with time-of-day and weather. The character rules
  produce exposure; future inventory/survival systems decide water consumption and harm.

## Composition Order

1. Terrain supplies base material and traversal facts.
2. Surface/weather layers add temporary conditions.
3. Road/water structures add route capabilities or crossings.
4. Character role and equipment supply mitigation/capability tags.
5. Character rules return costs and exposure.
6. Movement, action, AI, and combat systems consume the result.

This order prevents equipment from rewriting the map and prevents the renderer from
becoming a physics authority.
