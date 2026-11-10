export function parseTrack( track: string ): { title: string; duration: string; } {
  const separatorIndex = track.lastIndexOf(" - ");

  if (separatorIndex === -1 ) {
    return {title: track, duration: ""};
  }

  return {
    title: track.slice(0, separatorIndex),
    duration: track.slice(separatorIndex + 3),
  };
}