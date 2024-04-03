import React, { useState, useEffect } from "react";
import axios from "axios";
import "./Emails.scss";
import { useParams, useNavigate, Link } from "react-router-dom";
import Panel from "../../components/Panel/Panel";
import Alert from "@mui/material/Alert";
import Stack from "@mui/material/Stack";
import Chip from "@mui/material/Chip";
import Rating from "@mui/material/Rating";
import StarIcon from "@mui/icons-material/Star";
import StarBorderIcon from "@mui/icons-material/StarBorder";
import { useSelector } from "react-redux";
import Spinnerf from "../../components/Spinnerf";
import CancelIcon from "@mui/icons-material/Cancel";
import Checkbox from "@mui/material/Checkbox";
import { Radio, RadioGroup, FormControlLabel } from "@mui/material";
import LinearProgress from "@mui/joy/LinearProgress";
import {
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Typography,
} from "@mui/material";
import KeyboardArrowUpIcon from "@mui/icons-material/KeyboardArrowUp";
import KeyboardArrowDownIcon from "@mui/icons-material/KeyboardArrowDown";
import Avatar from "@mui/joy/Avatar";
import AccordionGroup from "@mui/joy/AccordionGroup";
import { REACT_APP_BACK_URL } from "../../config/config";
import {
  TextField,
  TextareaAutosize,
  Select,
  MenuItem,
  Button,
  FormControl,
  InputLabel,
  Input,
  FormHelperText,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from "@mui/material";
import Papa from "papaparse";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Paper from "@mui/material/Paper";

export default function Emails() {
  const [emails, setemails] = useState([]);
  const admin = useSelector((state) => state.admin.admin);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        if (admin.email.length > 0) {
          setLoading(true);
          const response = await axios.get(
            `${REACT_APP_BACK_URL}/admin/get-emails`,
            {
              headers: {
                Authorization: `Bearer ${admin.token}`,
              },
            }
          );
          setemails(response.data.emails.reverse());
          setLoading(false);
        }
      } catch (error) {
        console.log(error);
        if (error.response && error.response.status === 401) {
          setLoading(false);
          return navigate(`/`);
        }
        setAlert(
          <Alert
            style={{ position: "fixed", bottom: "3%", left: "2%", zIndex: 999 }}
            variant="filled"
            severity="error"
          >
            {error.response.data.error}
          </Alert>
        );
        setTimeout(() => setAlert(null), 5000);
        setLoading(false);
      }
    };

    fetchData();
  }, [admin]);
  return (
    <div id="Emails" className="Emails flex">
      <Panel />
      <Stack spacing={2}>{alert}</Stack>
      <div className="flex flex-col gap-2 flex-1">
        <div
          className="flex h-24 w-full py-4 px-6 md:hidden"
          style={{ borderBottom: "1px solid #B0BBC9" }}
        >
          <img
            src="/public\Assets\Images\logo3.png"
            className="object-contain"
            alt=""
          />
        </div>
        <div className="flex flex-col justify-center gap-8 w-full md:items-center p-6">
          <h1 className="Emails-title">Emails</h1>
          {emails && emails.length > 0 ? (
            <TableContainer component={Paper}>
              <Table sx={{ minWidth: 650 }} aria-label="simple table">
                <TableHead>
                  <TableRow>
                    <TableCell align="center">Sl. no</TableCell>
                    <TableCell align="center">Email</TableCell>
                    <TableCell align="center">to</TableCell>
                    <TableCell align="center">Time</TableCell>
                    <TableCell align="center">Subject</TableCell>
                    <TableCell align="center">Body</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {emails.map((mail, index) => (
                    <TableRow
                      key={index}
                      sx={{ "&:last-child td, &:last-child th": { border: 0 } }}
                    >
                      <TableCell component="th" scope="row">
                        {index + 1}
                      </TableCell>
                      <TableCell component="th" scope="row">
                        {mail.email}
                      </TableCell>
                      <TableCell component="th" scope="row">
                        {mail.to}
                      </TableCell>
                      <TableCell align="center" scope="row">
                        {mail.time}
                      </TableCell>
                      <TableCell align="center" scope="row">
                        {mail.subject}
                      </TableCell>
                      <TableCell align="center" scope="row">
                        {mail.body}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          ) : (
            <Spinnerf />
          )}
        </div>
      </div>
    </div>
  );
}
