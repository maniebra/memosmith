const assert = (ok: unknown, msg: string) => { if (!ok) throw new Error(msg); };
import { themedSource } from "./plantuml";

assert(themedSource("@startuml\nA -> B\n@enduml", "") === "@startuml\nA -> B\n@enduml", "no theme, no edit");
assert(
  themedSource("@startuml\nA -> B\n@enduml", " cyborg ") === "@startuml\n!theme cyborg\nA -> B\n@enduml",
  "theme goes under the opening directive",
);
assert(
  themedSource("@startmindmap\n* root\n@endmindmap", "hacker").split("\n")[1] === "!theme hacker",
  "non-uml diagrams are themed the same way",
);
assert(
  themedSource("@startuml\n!theme mine\nA -> B\n@enduml", "cyborg").includes("!theme cyborg") === false,
  "a diagram that picks its own theme keeps it",
);
assert(themedSource("A -> B", "cyborg") === "!theme cyborg\nA -> B", "a bare diagram gets the theme on top");

console.log("plantuml ok");
