/**
 * A template fixture's child, as a host hands it to `cedar-embeddable-field`.
 *
 * A template's `properties` entry is the field as the template places it: an array-valued
 * child wraps the field in `items`, and the field states whether the template requires it.
 * A field written on its own states neither, and the element refuses one that does. So the
 * field is unwrapped, its requirement is cleared, and the requirement is returned as the
 * `required` setting with which a host placing the field says the same thing.
 */
window.ceeStandaloneField = function (child) {
  var field = structuredClone(child.items || child);
  var constraints = field._valueConstraints;
  var required = !!constraints && constraints.requiredValue === true;
  if (constraints) {
    constraints.requiredValue = false;
    delete constraints.recommendedValue;
  }
  return { field: field, placement: { required: required } };
};
