import { matchDoctor } from "../services/doctorMatchingService.js";
import { getAvailableSlots } from "../services/slotService.js";

console.log("Doctor matching tests:");
console.log(matchDoctor("itchy skin rash on my arm").doctor.specialty);
console.log(matchDoctor("my knee hurts after a fall").doctor.specialty);
console.log(matchDoctor("migraine and dizziness").doctor.specialty);
console.log(matchDoctor("chest pressure and palpitations").doctor.specialty);

console.log("\nSlot filter tests:");
console.log(getAvailableSlots("doc-derma-1", "tuesday").slots.slice(0, 2));
console.log(getAvailableSlots("doc-derma-1", "morning").slots.slice(0, 2));
console.log(getAvailableSlots("doc-derma-1", "next week").slots.slice(0, 2));
