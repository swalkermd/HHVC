// Test with line break inside color tag
const testInput1 = `*y* = -{3/7}*x* + 2 → [red:*y* = -{3/7}*x*
+ 2]`;

console.log("Test 1 - Line break inside color tag:");
console.log("Input:", testInput1);

let result = testInput1;
let prevResult = '';
while (prevResult !== result) {
  prevResult = result;
  result = result.replace(/(\[(?:red|blue|green|orange|purple|yellow):[^\]\n]*)\n([^\]]*)/gi, '$1 $2');
}
console.log("Output:", result);

// Test 2 - Line break inside fraction
const testInput2 = `*y* = -{3/
7}*x* + 2`;

console.log("\nTest 2 - Line break inside fraction:");
console.log("Input:", testInput2);

result = testInput2;
prevResult = '';
while (prevResult !== result) {
  prevResult = result;
  result = result.replace(/(\{[^}\n]*)\n([^}]*)/g, '$1$2');
}
console.log("Output:", result);
