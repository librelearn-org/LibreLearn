import { type GradeMaker, Grade, globalModuleTracker } from "@siemsiem/learnlib";

export class noGradeMaker implements GradeMaker {
    type = "gradeMaker" as const;
    id = "noGradeMaker";
    name = { EN: "Ask me", NL: "Vraag me" };
    description = {
        EN: "On answer we ask you how well you remembered the word.",
        NL: "Na het antwoorden vragen we je hoe goed je het woord herinderde.",
    };

    grade(correct: boolean, start: Date, now: Date, overwrite?: Grade): Grade {
        if (overwrite !== undefined) return overwrite;
        if (correct) {
            console.warn("Geen overwrite op een correct antwoord!!!")
            return Grade.Good
        } else {
            return Grade.Incorrect
        }
    }
}

globalModuleTracker.register(new noGradeMaker());