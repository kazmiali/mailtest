// src/index.ts
function validateEmail(email) {
  if (!email || typeof email !== "string") {
    return false;
  }
  return email.includes("@");
}
var VERSION = "1.0.0";

export { VERSION, validateEmail };
//# sourceMappingURL=index.js.map
//# sourceMappingURL=index.js.map