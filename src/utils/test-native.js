const { MlKem768 } = require("mlkem");

const mlkem = new MlKem768();
console.log(
  "Native MlKem768 methods:",
  Object.getOwnPropertyNames(MlKem768.prototype)
);
console.log("Instance methods:", Object.getOwnPropertyNames(mlkem));
console.log(
  "Instance methods (including non-enumerable):",
  Object.getOwnPropertyNames(Object.getPrototypeOf(mlkem))
);
