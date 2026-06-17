import generalTextSource from '../../text/export-dialog/general.txt';
import helpTextSource from '../../text/export-dialog/help.txt';
import lodsTextSource from '../../text/export-dialog/lods.txt';
import materialsTextSource from '../../text/export-dialog/materials.txt';
import sequencesTextSource from '../../text/export-dialog/sequences.txt';
import { parseTextSections } from '../../text/sections';

export const generalText = parseTextSections(generalTextSource);
export const materialsText = parseTextSections(materialsTextSource);
export const sequencesText = parseTextSections(sequencesTextSource);
export const lodsText = parseTextSections(lodsTextSource);
export const helpText = parseTextSections(helpTextSource);
