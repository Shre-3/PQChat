const { MlKem768 } = require("mlkem");

console.log("MlKem768 class:", MlKem768);
const mlkem = new MlKem768();
console.log("MlKem768 instance:", mlkem);
console.log(
  "Available methods:",
  Object.getOwnPropertyNames(MlKem768.prototype)
);
console.log("Instance methods:", Object.getOwnPropertyNames(mlkem));
