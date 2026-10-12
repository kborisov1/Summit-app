/**
 * Facts pinned to the mountain at their real heights, passed on the way up
 * (scope "Experience"). Major entries name the scenery's zones.
 */
export interface Landmark {
  altitude: number;
  text: string;
  major?: boolean;
}

export const LANDMARKS: readonly Landmark[] = [
  { altitude: 0, text: 'THE FOOTHILLS', major: true },
  { altitude: 330, text: 'the Eiffel Tower would reach this high' },
  { altitude: 828, text: 'the top of the Burj Khalifa' },
  { altitude: 1345, text: 'Ben Nevis, Britain’s highest peak' },
  { altitude: 2000, text: 'THE ALPINE ZONE', major: true },
  { altitude: 2500, text: 'altitude sickness can start here' },
  { altitude: 2962, text: 'the Zugspitze, Germany’s highest peak' },
  { altitude: 3776, text: 'the summit of Mount Fuji' },
  { altitude: 4500, text: 'THE GLACIERS', major: true },
  { altitude: 4806, text: 'the summit of Mont Blanc' },
  { altitude: 5364, text: 'Everest Base Camp' },
  { altitude: 5500, text: 'half the oxygen of sea level' },
  { altitude: 5895, text: 'the summit of Kilimanjaro' },
  { altitude: 6400, text: 'Camp II in the Western Cwm' },
  { altitude: 6961, text: 'Aconcagua, the highest peak outside Asia' },
  { altitude: 7906, text: 'Camp IV on the South Col' },
  { altitude: 8000, text: 'THE DEATH ZONE', major: true },
  { altitude: 8611, text: 'the summit of K2' },
  { altitude: 8790, text: 'the Hillary Step' },
  { altitude: 8848, text: 'THE SUMMIT', major: true },
];
