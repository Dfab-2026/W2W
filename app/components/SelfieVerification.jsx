
import { useState } from "react";

export default function SelfieVerification() {
  const [selfieFile, setSelfieFile] = useState(null);
  const [selfiePreview, setSelfiePreview] = useState("");
  const [selfieStatus, setSelfieStatus] = useState("not_submitted");
}
