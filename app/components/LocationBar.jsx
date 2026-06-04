
import { useState } from "react";

export default function LocationBar() {
  const [location, setLocation] = useState("");
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [locationSaved, setLocationSaved] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
}
