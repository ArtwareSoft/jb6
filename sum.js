/**
 * Calculates the sum of an array of numbers.
 * @param {number[]} numbers - The array of numbers to sum.
 * @returns {number} The sum of the numbers.
 */
function sumArray(numbers) {
  if (!Array.isArray(numbers)) {
    return 0;
  }
  return numbers.reduce((sum, current) => sum + current, 0);
}

// Example Usage:
const myNumbers = [1, 2, 3, 4, 5];
const result = sumArray(myNumbers);
console.log(`The sum of [${myNumbers}] is: ${result}`);

const anotherSetOfNumbers = [10, -2, 0, 5];
const anotherResult = sumArray(anotherSetOfNumbers);
console.log(`The sum of [${anotherSetOfNumbers}] is: ${anotherResult}`);

const emptyArray = [];
const emptyResult = sumArray(emptyArray);
console.log(`The sum of an empty array is: ${emptyResult}`);
