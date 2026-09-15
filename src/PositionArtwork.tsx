import { extractPositionArtworkImage } from "./positionArtwork";
import { useMemo } from "react";
import "./positionArtwork.css";

export function PositionArtwork({
  metadata,
  positionId,
}: {
  metadata: string;
  positionId?: string;
}) {
  const image = useMemo(
    () => extractPositionArtworkImage(metadata),
    [metadata],
  );
  const label = positionId
    ? `Position NFT artwork for position #${positionId}`
    : "Position NFT artwork";
  return (
    <figure className="position-artwork">
      {image ? (
        <img
          className="position-artwork-image"
          src={image}
          alt={label}
          width={640}
          height={640}
          decoding="async"
        />
      ) : (
        <p className="position-artwork-fallback" role="status">
          Artwork unavailable.
        </p>
      )}
    </figure>
  );
}
