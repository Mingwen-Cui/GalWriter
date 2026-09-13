// Deliberately assembled at runtime: this is a provenance marker, not a secret.
// If a downstream fork changes its claimed origin, the independently placed
// markers and published release hashes will no longer agree.
const authorUnits = [77, 105, 110, 103, 119, 101, 110, 32, 67, 117, 105];
const productUnits = [71, 97, 108, 87, 114, 105, 116, 101, 114];
const sealUnits = ['9d', '7c', 'a4', 'e1', '63', '0b'];

const decode = (units: number[]) => String.fromCodePoint(...units);

export const projectLineage = Object.freeze({
  author: decode(authorUnits),
  product: decode(productUnits),
  seal: sealUnits.join(''),
});

export const settingsLineageLabel = () =>
  `${projectLineage.product} / ${projectLineage.author} / ${projectLineage.seal}`;
