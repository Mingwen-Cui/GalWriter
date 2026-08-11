# Character appearance demo assets

Every file is a transparent PNG on the same **2048 x 3072** canvas. The face center is fixed at `(1024, 620)`. Outfit images must leave this face area transparent.

```text
characters/<character-id>/faces/<expression-id>.png
characters/<character-id>/hair/<hair-style-id>.png
characters/<character-id>/outfits/<outfit-id>/palette.png
```

The demo catalog is merely example data. Its arrays can contain any number of expressions, hairstyles, and outfits for every character.

Face images contain the face and facial features only. Hair images contain only the hairstyle. Each outfit image includes the neck-down body, hands, legs and clothes, with a transparent face window.

Use only these indexed grayscale values in every PNG:

```text
#111111 outline
#5A5A5A deep shadow
#9E9E9E base tone
#D4D4D4 secondary tone
#F5F5F5 highlight tone
```

Outfit tones map to outline, primary-shadow, primary, secondary and accent. Face tones map to outline, face shadow, face midtone, skin shadow and skin. Hair tones map to outline, deep hair, hair, hair highlight and bright hair highlight.
