import type { SampleTrack } from "@/domain/sampleBank";

/**
 * The instant sample track (owner, 2026-11-18): "The Solar System", written in advance so a new learner can sit an
 * exam a second after choosing it, with no AI cost. Short answers are single words, so they're marked by exact
 * match (rules §6). Topic indexes follow `topics`.
 */
export const solarSystem: SampleTrack = {
  key: "solar_system",
  name: "The Solar System",
  topics: [
    { name: "The Sun and the order of the planets", description: "The Sun as a star, the eight planets in order, orbits and distances." },
    { name: "The rocky planets", description: "Mercury, Venus, Earth and Mars." },
    { name: "The giant planets", description: "Jupiter, Saturn, Uranus and Neptune." },
    { name: "Moons, dwarf planets and small bodies", description: "Moons, Pluto and other dwarf planets, asteroids, comets and meteors." },
  ],
  questions: [
    // ── 0 · The Sun and the order of the planets
    { topic: 0, type: "multiple_choice", prompt: "Which planet is closest to the Sun?", options: ["Venus", "Mercury", "Earth", "Mars"], correctIndex: 1, difficulty: 1, explanation: "Mercury orbits closest to the Sun, about 58 million km away." },
    { topic: 0, type: "multiple_choice", prompt: "What kind of object is the Sun?", options: ["A planet", "A star", "A moon", "A comet"], correctIndex: 1, difficulty: 1, explanation: "The Sun is a star: a huge ball of hot gas that makes its own light." },
    { topic: 0, type: "multiple_choice", prompt: "Moving away from the Sun, which planet comes straight after Earth?", options: ["Venus", "Jupiter", "Mars", "Saturn"], correctIndex: 2, difficulty: 1, explanation: "The order is Mercury, Venus, Earth, Mars, so Mars comes after Earth." },
    { topic: 0, type: "multiple_choice", prompt: "Which planet is farthest from the Sun?", options: ["Uranus", "Saturn", "Pluto", "Neptune"], correctIndex: 3, difficulty: 2, explanation: "Neptune is the eighth and farthest planet; Pluto is now a dwarf planet." },
    { topic: 0, type: "multiple_choice", prompt: "How many planets orbit the Sun?", options: ["7", "8", "9", "10"], correctIndex: 1, difficulty: 1, explanation: "There have been eight planets since Pluto was reclassified as a dwarf planet in 2006." },
    { topic: 0, type: "multiple_choice", prompt: "Between which two planets is the main asteroid belt?", options: ["Earth and Mars", "Mars and Jupiter", "Jupiter and Saturn", "Venus and Earth"], correctIndex: 1, difficulty: 2, explanation: "The main asteroid belt lies between the orbits of Mars and Jupiter." },
    { topic: 0, type: "multiple_choice", prompt: "About how long does sunlight take to reach Earth?", options: ["8 seconds", "8 minutes", "8 hours", "8 days"], correctIndex: 1, difficulty: 3, explanation: "Light covers the 150 million km in about 8 minutes and 20 seconds." },
    { topic: 0, type: "multiple_choice", prompt: "What keeps the planets moving in orbits around the Sun?", options: ["Magnetism", "Gravity", "Sunlight", "Air pressure"], correctIndex: 1, difficulty: 2, explanation: "The Sun's gravity pulls on each planet and keeps it in orbit." },
    { topic: 0, type: "short", prompt: "Which planet comes between Venus and Mars?", expectedAnswer: "Earth", difficulty: 1, explanation: "Earth is the third planet: Mercury, Venus, Earth, Mars." },
    { topic: 0, type: "short", prompt: "Which planet is second from the Sun?", expectedAnswer: "Venus", difficulty: 2, explanation: "Venus is second, between Mercury and Earth." },
    { topic: 0, type: "short", prompt: "Which planet is fifth from the Sun?", expectedAnswer: "Jupiter", difficulty: 2, explanation: "After the four rocky planets comes Jupiter, the first giant." },
    { topic: 0, type: "short", prompt: "Which planet is seventh from the Sun?", expectedAnswer: "Uranus", difficulty: 3, explanation: "The giants in order are Jupiter, Saturn, Uranus and Neptune, so Uranus is seventh." },

    // ── 1 · The rocky planets
    { topic: 1, type: "multiple_choice", prompt: "Which planet is known as the Red Planet?", options: ["Mars", "Venus", "Mercury", "Jupiter"], correctIndex: 0, difficulty: 1, explanation: "Mars is called the Red Planet because of its reddish dust." },
    { topic: 1, type: "multiple_choice", prompt: "Which planet is the hottest?", options: ["Mercury", "Venus", "Mars", "Earth"], correctIndex: 1, difficulty: 3, explanation: "Venus's thick carbon dioxide atmosphere traps heat, so it reaches about 465 °C, hotter than Mercury." },
    { topic: 1, type: "multiple_choice", prompt: "What makes Mars look red?", options: ["Iron oxide (rust) in its dust", "Red oceans", "Lava covering it", "Red light from the Sun"], correctIndex: 0, difficulty: 2, explanation: "Mars's surface dust is rich in iron oxide, the same substance as rust." },
    { topic: 1, type: "multiple_choice", prompt: "How many moons does Mars have?", options: ["0", "1", "2", "4"], correctIndex: 2, difficulty: 3, explanation: "Mars has two small moons, Phobos and Deimos." },
    { topic: 1, type: "multiple_choice", prompt: "What is the name of the giant volcano on Mars, the tallest in the Solar System?", options: ["Mauna Kea", "Olympus Mons", "Mount Etna", "Vesuvius"], correctIndex: 1, difficulty: 3, explanation: "Olympus Mons is about 22 km high, more than twice the height of Mount Everest." },
    { topic: 1, type: "multiple_choice", prompt: "Which planet spins so slowly that its day is longer than its year?", options: ["Venus", "Mars", "Earth", "Mercury"], correctIndex: 0, difficulty: 4, explanation: "Venus takes 243 Earth days to spin once but only 225 to orbit the Sun." },
    { topic: 1, type: "multiple_choice", prompt: "Why are Mercury, Venus, Earth and Mars called rocky planets?", options: ["They have rings", "They have solid, rocky surfaces", "They are made mostly of gas", "They have no atmosphere"], correctIndex: 1, difficulty: 2, explanation: "The four inner planets are made of rock and metal with solid surfaces." },
    { topic: 1, type: "multiple_choice", prompt: "Which planet is closest in size to Earth?", options: ["Venus", "Mars", "Mercury", "Neptune"], correctIndex: 0, difficulty: 2, explanation: "Venus is almost the same size as Earth, which is why it's sometimes called Earth's twin." },
    { topic: 1, type: "short", prompt: "Which is the smallest planet in the Solar System?", expectedAnswer: "Mercury", difficulty: 2, explanation: "Mercury is the smallest planet, only a little larger than Earth's Moon." },
    { topic: 1, type: "short", prompt: "Which is the only planet known to have life?", expectedAnswer: "Earth", difficulty: 1, explanation: "So far, Earth is the only place where life has been found." },
    { topic: 1, type: "short", prompt: "Which planet has a thick atmosphere of carbon dioxide with clouds of sulfuric acid?", expectedAnswer: "Venus", difficulty: 4, explanation: "Venus's dense carbon dioxide air and acid clouds make it the hottest planet." },
    { topic: 1, type: "short", prompt: "On which planet did the rovers Curiosity and Perseverance land?", expectedAnswer: "Mars", difficulty: 2, explanation: "NASA's Curiosity (2012) and Perseverance (2021) rovers explore Mars." },

    // ── 2 · The giant planets
    { topic: 2, type: "multiple_choice", prompt: "Which is the largest planet?", options: ["Saturn", "Jupiter", "Neptune", "Earth"], correctIndex: 1, difficulty: 1, explanation: "Jupiter is the largest planet; more than 1,300 Earths could fit inside it." },
    { topic: 2, type: "multiple_choice", prompt: "Which planet is best known for its bright rings?", options: ["Saturn", "Mars", "Venus", "Mercury"], correctIndex: 0, difficulty: 1, explanation: "All four giant planets have rings, but Saturn's are by far the brightest." },
    { topic: 2, type: "multiple_choice", prompt: "What is Jupiter's Great Red Spot?", options: ["A giant storm", "A volcano", "A crater", "An ocean"], correctIndex: 0, difficulty: 2, explanation: "The Great Red Spot is a storm wider than Earth that has lasted for centuries." },
    { topic: 2, type: "multiple_choice", prompt: "Which planet spins on its side, tilted about 98 degrees?", options: ["Uranus", "Neptune", "Saturn", "Jupiter"], correctIndex: 0, difficulty: 3, explanation: "Uranus is tipped over, so it seems to roll around the Sun on its side." },
    { topic: 2, type: "multiple_choice", prompt: "What are Jupiter and Saturn made mostly of?", options: ["Rock and iron", "Hydrogen and helium", "Water and ice", "Carbon dioxide"], correctIndex: 1, difficulty: 3, explanation: "Jupiter and Saturn are gas giants, made mostly of hydrogen and helium." },
    { topic: 2, type: "multiple_choice", prompt: "Which planet was predicted by mathematics before anyone saw it through a telescope?", options: ["Neptune", "Uranus", "Saturn", "Jupiter"], correctIndex: 0, difficulty: 4, explanation: "Wobbles in Uranus's orbit led astronomers to calculate where Neptune was; it was found there in 1846." },
    { topic: 2, type: "multiple_choice", prompt: "Why do Uranus and Neptune look blue?", options: ["Methane in their atmospheres", "Oceans on their surfaces", "Light reflected from Earth", "Rings made of blue ice"], correctIndex: 0, difficulty: 4, explanation: "Methane gas absorbs red light, so the light they reflect looks blue." },
    { topic: 2, type: "multiple_choice", prompt: "Which of these planets is an ice giant?", options: ["Neptune", "Jupiter", "Saturn", "Mars"], correctIndex: 0, difficulty: 3, explanation: "Uranus and Neptune are ice giants: mostly water, ammonia and methane ices around a rocky core." },
    { topic: 2, type: "short", prompt: "Which planet is sixth from the Sun?", expectedAnswer: "Saturn", difficulty: 2, explanation: "Saturn comes after Jupiter, sixth from the Sun." },
    { topic: 2, type: "short", prompt: "Which planet has the fastest winds in the Solar System?", expectedAnswer: "Neptune", difficulty: 4, explanation: "Winds on Neptune reach about 2,000 km/h." },
    { topic: 2, type: "short", prompt: "Which planet is less dense than water, so it would float in a big enough bath?", expectedAnswer: "Saturn", difficulty: 3, explanation: "Saturn is mostly light gases, so on average it is less dense than water." },
    { topic: 2, type: "short", prompt: "Which planet has the largest moon in the Solar System, Ganymede?", expectedAnswer: "Jupiter", difficulty: 3, explanation: "Ganymede, Jupiter's biggest moon, is even larger than the planet Mercury." },

    // ── 3 · Moons, dwarf planets and small bodies
    { topic: 3, type: "multiple_choice", prompt: "What is a moon?", options: ["A natural object that orbits a planet", "A small star", "A piece of the Sun", "A planet with no air"], correctIndex: 0, difficulty: 1, explanation: "A moon is a natural satellite: an object that orbits a planet." },
    { topic: 3, type: "multiple_choice", prompt: "Which of these was reclassified as a dwarf planet in 2006?", options: ["Pluto", "Mercury", "Mars", "Uranus"], correctIndex: 0, difficulty: 1, explanation: "Pluto is now a dwarf planet because it shares its orbit with many other icy objects." },
    { topic: 3, type: "multiple_choice", prompt: "What is a comet mostly made of?", options: ["Ice, dust and rock", "Molten iron", "Hydrogen gas", "Sand"], correctIndex: 0, difficulty: 2, explanation: "Comets are 'dirty snowballs' of ice, dust and rock; near the Sun they grow tails." },
    { topic: 3, type: "multiple_choice", prompt: "What do we call the streak of light made by a space rock burning up in Earth's atmosphere?", options: ["A meteor", "A comet", "An asteroid", "A moon"], correctIndex: 0, difficulty: 2, explanation: "A meteor, or shooting star, is the glow of a space rock burning up in the air." },
    { topic: 3, type: "multiple_choice", prompt: "Which of Saturn's moons has a thick atmosphere and lakes of liquid methane?", options: ["Titan", "Europa", "Io", "Phobos"], correctIndex: 0, difficulty: 3, explanation: "Titan is the only moon with a thick atmosphere, and it has methane lakes and rain." },
    { topic: 3, type: "multiple_choice", prompt: "Which of Jupiter's moons has the most active volcanoes?", options: ["Io", "Europa", "Callisto", "Ganymede"], correctIndex: 0, difficulty: 4, explanation: "Io is the most volcanically active body in the Solar System." },
    { topic: 3, type: "multiple_choice", prompt: "Why does the Moon seem to change shape, from crescent to full?", options: ["We see different amounts of its sunlit half as it orbits Earth", "Earth's shadow covers part of it", "It really changes shape", "Clouds block part of it"], correctIndex: 0, difficulty: 3, explanation: "Half the Moon is always lit by the Sun; as it orbits, we see more or less of that half. Earth's shadow only matters in an eclipse." },
    { topic: 3, type: "multiple_choice", prompt: "What covers much of the Moon's surface, made by space rocks crashing into it?", options: ["Craters", "Oceans", "Forests", "Ice sheets"], correctIndex: 0, difficulty: 1, explanation: "With no air or weather to wear them away, the Moon's craters last for billions of years." },
    { topic: 3, type: "short", prompt: "Which dwarf planet is the largest object in the asteroid belt?", expectedAnswer: "Ceres", difficulty: 4, explanation: "Ceres is about 940 km across and is both the largest asteroid-belt object and a dwarf planet." },
    { topic: 3, type: "short", prompt: "What is a space rock called once it has landed on Earth?", expectedAnswer: "Meteorite", difficulty: 3, explanation: "In space it's a meteoroid, in the air a meteor, and on the ground a meteorite." },
    { topic: 3, type: "short", prompt: "What is the name of Pluto's largest moon?", expectedAnswer: "Charon", difficulty: 5, explanation: "Charon is about half Pluto's width, so large that the two orbit a point between them." },
    { topic: 3, type: "short", prompt: "Halley's is a famous example of which kind of object?", expectedAnswer: "Comet", difficulty: 2, explanation: "Halley's Comet returns about every 76 years; it was last seen in 1986." },
  ],
  flashcards: [
    { topic: 0, front: "The planets in order from the Sun", answer: "Mercury, Venus, Earth, Mars, Jupiter, Saturn, Uranus, Neptune", explanation: "One way to remember: My Very Easy Method Just Speeds Up Naming." },
    { topic: 0, front: "What is the Sun?", answer: "A star: a huge ball of hot gas, mostly hydrogen and helium", explanation: "It holds more than 99% of the Solar System's mass." },
    { topic: 0, front: "Astronomical unit (AU)", answer: "The average distance from Earth to the Sun, about 150 million km", explanation: "Astronomers use it to measure distances in the Solar System." },
    { topic: 0, front: "Inner planets and outer planets", answer: "Inner: Mercury to Mars (rocky). Outer: Jupiter to Neptune (giants).", explanation: "The asteroid belt lies between the two groups." },
    { topic: 0, front: "Orbit", answer: "The curved path one object takes around another, held by gravity", explanation: "Earth takes about 365 days to orbit the Sun once." },
    { topic: 1, front: "Mercury", answer: "The smallest planet and the closest to the Sun, with no moons", explanation: "Its year lasts only 88 Earth days." },
    { topic: 1, front: "Venus", answer: "The hottest planet, about 465 °C", explanation: "Its thick carbon dioxide atmosphere traps heat (the greenhouse effect)." },
    { topic: 1, front: "Earth", answer: "The only planet known to have life and liquid water on its surface", explanation: "It is the largest of the four rocky planets." },
    { topic: 1, front: "Mars", answer: "The Red Planet, with two small moons, Phobos and Deimos", explanation: "Iron oxide (rust) in its dust gives it its colour." },
    { topic: 1, front: "Olympus Mons", answer: "The tallest volcano in the Solar System, on Mars", explanation: "It is about 22 km high, more than twice the height of Mount Everest." },
    { topic: 2, front: "Jupiter", answer: "The largest planet, home of the Great Red Spot storm", explanation: "More than 1,300 Earths could fit inside it." },
    { topic: 2, front: "Saturn", answer: "The planet with the brightest rings, made of ice and rock", explanation: "It is less dense than water." },
    { topic: 2, front: "Uranus", answer: "The ice giant that spins on its side", explanation: "Its axis is tilted about 98 degrees." },
    { topic: 2, front: "Neptune", answer: "The farthest planet, with the fastest winds", explanation: "Winds there reach about 2,000 km/h." },
    { topic: 2, front: "Gas giants and ice giants", answer: "Gas giants: Jupiter and Saturn. Ice giants: Uranus and Neptune.", explanation: "None of them has a solid surface to stand on." },
    { topic: 3, front: "Dwarf planet", answer: "A round body orbiting the Sun that hasn't cleared its orbit of other objects", explanation: "Pluto and Ceres are dwarf planets." },
    { topic: 3, front: "Asteroid", answer: "A rocky object orbiting the Sun, smaller than a planet", explanation: "Most are in the asteroid belt between Mars and Jupiter." },
    { topic: 3, front: "Meteor and meteorite", answer: "A meteor is the streak of light; a meteorite is the rock that reaches the ground", explanation: "Out in space, before it hits the air, it's called a meteoroid." },
    { topic: 3, front: "Comet", answer: "A ball of ice, dust and rock that grows a glowing tail near the Sun", explanation: "The tail always points away from the Sun." },
    { topic: 3, front: "Titan", answer: "Saturn's largest moon, with a thick atmosphere and methane lakes", explanation: "It is the only moon with a thick atmosphere." },
  ],
};
