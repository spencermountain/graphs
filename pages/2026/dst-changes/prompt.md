in changes.json, there is a list of timezones with their dst change dates.

Please render them in a vertical list, where each row represents the calendar year, with January 1 being the left side in December 31 being the right side. For each row, please render the name of the time zone on the left, and a small, subtle underline representing the start and the end of the DST change. Each row should be not much more than the height of the text.
The overall idea of is to be able to visually scan when in the year each of the DST changes occur, do they cluster in a particular part of the year?
Please start the time zones alphabetically by name.
Please add a subtle indicator showing the current place in the year.

Please use the space-time JavaScript library for date calculations, and you're welcome to ignore the hours of the DST changes.

Please let me know if you run into any issues or have questions.